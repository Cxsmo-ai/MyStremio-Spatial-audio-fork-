use crate::stremio_app::custom_api;
use crate::stremio_app::ipc;
use crate::stremio_app::RPCResponse;
use flume::{Receiver, Sender};
use libmpv2::{events::Event, events::EventContext, Format, Mpv, SetData};
use native_windows_gui::{self as nwg, PartialUi};
use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
    thread::{self, JoinHandle},
};
use winapi::shared::windef::HWND;

use crate::stremio_app::stremio_player::{
    CmdVal, InMsg, InMsgArgs, InMsgFn, MpvCmd, PlayerEnded, PlayerEvent, PlayerProprChange,
    PlayerResponse, PropKey, PropVal,
};

#[derive(Default)]
pub struct Player {
    pub channel: ipc::Channel,
}

impl PartialUi for Player {
    fn build_partial<W: Into<nwg::ControlHandle>>(
        // @TODO replace with `&mut self`?
        data: &mut Self,
        parent: Option<W>,
    ) -> Result<(), nwg::NwgError> {
        // @TODO replace all `expect`s with proper error handling?

        let window_handle = parent
            .expect("no parent window")
            .into()
            .hwnd()
            .expect("cannot obtain window handle");

        let (in_msg_sender, in_msg_receiver) = flume::unbounded();
        let (rpc_response_sender, rpc_response_receiver) = flume::unbounded();
        data.channel = ipc::Channel::new(Some((in_msg_sender, rpc_response_receiver)));

        let mpv = create_shareable_mpv(window_handle);

        let _event_thread = create_event_thread(
            mpv,
            in_msg_receiver,
            rpc_response_sender,
        );
        // @TODO implement a mechanism to stop threads on `Player` drop if needed

        Ok(())
    }
}

fn create_shareable_mpv(window_handle: HWND) -> Arc<Mpv> {
    let omniphony = OmniphonyRuntime::discover();
    let mpv = Mpv::with_initializer(|initializer| {
        macro_rules! set_property {
            ($name:literal, $value:expr) => {
                initializer
                    .set_property($name, $value)
                    .expect(concat!("failed to set ", $name));
            };
        }
        macro_rules! set_optional_property {
            ($name:literal, $value:expr) => {
                if let Err(error) = initializer.set_property($name, $value) {
                    eprintln!("ignored optional mpv option {}: {error:?}", $name);
                }
            };
        }
        set_property!("wid", window_handle as i64);
        set_property!("title", "MyStremio");
        set_property!("audio-client-name", "MyStremio");
        set_property!("terminal", "yes");
        set_property!("config", "yes");
        if let Some(config_dir) = omniphony.config_dir.as_deref() {
            set_property!("config-dir", config_dir);
        }
        if let Some(input_conf) = omniphony.input_conf.as_deref() {
            set_property!("input-conf", input_conf);
        }
        #[cfg(debug_assertions)]
        set_property!("msg-level", "all=no,cplayer=debug");
        #[cfg(not(debug_assertions))]
        set_property!("msg-level", "all=no");
        set_property!("quiet", "yes");
        set_property!("hwdec", "auto");
        set_property!("cache", "yes");
        // Fast first frame: small startup cache (user preload boost applies after playback starts).
        set_property!("cache-secs", "12");
        set_property!("demuxer-readahead-secs", "12");
        set_property!("demuxer-max-bytes", "200MiB");
        set_property!("cache-pause-initial", "no");
        // TIDAL DASH segments can arrive in short bursts. Keep a larger
        // audio cushion and fill brief network timing gaps instead of
        // producing audible dropouts.
        set_property!("audio-buffer", "0.5");
        set_property!("audio-stream-silence", "yes");
        set_property!("network-timeout", "30");
        set_property!("vo", "gpu-next,");
        set_property!("gpu-api", "vulkan");
        set_optional_property!("ad", "orender,lavc,");
        set_optional_property!("ad-orender-osc", "yes");
        set_optional_property!("ad-orender-osc-rx-port", 9000i64);
        // 9000 is the renderer's incoming control/rendezvous port. Leave
        // outgoing monitoring automatic so Studio can own its receive socket;
        // forcing both directions to 9000 prevents the Studio handshake.
        set_optional_property!("ad-orender-osc-port", 0i64);
        set_optional_property!("ad-orender-osc-bind", "127.0.0.1");
        set_optional_property!("ad-orender-osc-monitor-target", "127.0.0.1");
        if let Some(orender_library) = omniphony.orender_library.as_deref() {
            set_optional_property!("ad-orender-library", orender_library);
        }
        if let Some(bridge_path) = omniphony.bridge_path.as_deref() {
            set_optional_property!("ad-orender-bridge-path", bridge_path);
        }
        if let Some(render_config) = omniphony.render_config.as_deref() {
            set_optional_property!("ad-orender-config", render_config);
        }
        Ok(())
    });
    let mpv = Arc::new(mpv.expect("cannot build MPV"));
    apply_stored_player_volume(&mpv);
    mpv
}

struct OmniphonyRuntime {
    config_dir: Option<String>,
    input_conf: Option<String>,
    orender_library: Option<String>,
    bridge_path: Option<String>,
    render_config: Option<String>,
}

impl OmniphonyRuntime {
    fn discover() -> Self {
        let exe_dir = env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        let _ = env::set_current_dir(&exe_dir);

        let candidate_roots = [exe_dir];
        let config_dir = first_existing(&candidate_roots, "portable_config");
        let input_conf = config_dir
            .as_ref()
            .map(|p| p.join("input.conf"))
            .filter(|p| p.exists());
        let orender_library = first_existing(&candidate_roots, "orender.dll");
        let bridge_path = first_existing(&candidate_roots, "harletty_bridge.dll");
        let render_config = first_existing(&candidate_roots, r"configs\binaural-headphones.yaml")
            .or_else(|| first_existing(&candidate_roots, r"configs\omniphony-portable.yaml"))
            .or_else(|| first_existing(&candidate_roots, r"configs\voicemeeter-7.1.yaml"))
            .or_else(|| first_existing(&candidate_roots, r"configs\high-channel-7.1.4.yaml"));

        Self {
            config_dir: path_to_mpv_string(config_dir),
            input_conf: path_to_mpv_string(input_conf),
            orender_library: path_to_mpv_string(orender_library),
            bridge_path: path_to_mpv_string(bridge_path),
            render_config: path_to_mpv_string(render_config),
        }
    }
}

fn first_existing(roots: &[PathBuf], relative: &str) -> Option<PathBuf> {
    roots
        .iter()
        .map(|root| root.join(relative))
        .find(|path| path.exists())
}

fn path_to_mpv_string(path: Option<PathBuf>) -> Option<String> {
    path.map(|p| p.to_string_lossy().replace('\\', "/"))
}

fn cmd_is_loadfile(cmd: &CmdVal) -> bool {
    matches!(
        cmd,
        CmdVal::Single((MpvCmd::Loadfile,))
            | CmdVal::Double(MpvCmd::Loadfile, _)
            | CmdVal::Tripple(MpvCmd::Loadfile, _, _)
            | CmdVal::Quadruple(MpvCmd::Loadfile, _, _, _)
            | CmdVal::Quintuple(MpvCmd::Loadfile, _, _, _, _)
    )
}

fn loadfile_target(cmd: &CmdVal) -> Option<&str> {
    match cmd {
        CmdVal::Double(MpvCmd::Loadfile, path)
        | CmdVal::Tripple(MpvCmd::Loadfile, path, _)
        | CmdVal::Quadruple(MpvCmd::Loadfile, path, _, _)
        | CmdVal::Quintuple(MpvCmd::Loadfile, path, _, _, _) => Some(path.as_str()),
        _ => None,
    }
}

fn is_transport_stream_target(target: &str) -> bool {
    let target = target
        .split(['?', '#'])
        .next()
        .unwrap_or(target)
        .trim_matches('"')
        .trim_end_matches('/');
    let lower = target.to_ascii_lowercase();
    [".m2ts", ".mts", ".m2t", ".ts"]
        .iter()
        .any(|ext| lower.ends_with(ext))
}

fn apply_stored_player_volume(mpv: &Mpv) {
    let stored = custom_api::player_volume();
    if let Some(level) = stored.get("level").and_then(|value| value.as_f64()) {
        let _ = mpv.set_property("volume", level.clamp(0.0, 100.0));
    }
    if let Some(muted) = stored.get("muted").and_then(|value| value.as_bool()) {
        let _ = mpv.set_property("mute", muted);
    }
}

fn apply_loadfile_profile(cmd: &CmdVal, mpv: &Mpv) {
    if let Some(target) = loadfile_target(cmd) {
        if is_transport_stream_target(target) {
            let _ = mpv.set_property("cache", "yes");
            let _ = mpv.set_property("cache-secs", 120i64);
            let _ = mpv.set_property("demuxer-readahead-secs", 120i64);
            let _ = mpv.set_property("demuxer-max-bytes", "1GiB");
            let _ = mpv.set_property("demuxer-max-back-bytes", "512MiB");
            let _ = mpv.set_property("hwdec-extra-frames", 16i64);
        } else {
            let _ = mpv.set_property("cache-secs", 12i64);
            let _ = mpv.set_property("demuxer-readahead-secs", 12i64);
            let _ = mpv.set_property("demuxer-max-bytes", "200MiB");
            let _ = mpv.set_property("demuxer-max-back-bytes", "100MiB");
            let _ = mpv.set_property("hwdec-extra-frames", 6i64);
        }
    }
}

fn set_mpv_property(name: impl ToString, value: impl SetData, mpv: &Mpv) {
    if let Err(error) = mpv.set_property(&name.to_string(), value) {
        eprintln!("cannot set MPV property: '{error:#}'")
    }
}

fn send_mpv_command(cmd: &CmdVal, mpv: &Mpv) {
    if cmd_is_loadfile(cmd) {
        apply_stored_player_volume(mpv);
        apply_loadfile_profile(cmd, mpv);
    }

    // libmpv2's command wrapper passes a command string internally. The
    // player URLs are already percent-encoded by Stremio, so add no extra
    // quote characters here: they become part of the URL.
    let result = match cmd {
        CmdVal::Quintuple(name, arg1, arg2, arg3, arg4) => mpv.command(
            &name.to_string(),
            &[arg1.as_ref(), arg2.as_ref(), arg3.as_ref(), arg4.as_ref()],
        ),
        CmdVal::Quadruple(name, arg1, arg2, arg3) => {
            mpv.command(&name.to_string(), &[arg1.as_ref(), arg2.as_ref(), arg3.as_ref()])
        }
        CmdVal::Tripple(name, arg1, arg2) => {
            mpv.command(&name.to_string(), &[arg1.as_ref(), arg2.as_ref()])
        }
        CmdVal::Double(name, arg1) => mpv.command(&name.to_string(), &[arg1.as_ref()]),
        CmdVal::Single((name,)) => mpv.command(&name.to_string(), &[]),
    };
    if let Err(error) = result {
        eprintln!("failed to execute MPV command: '{error:#}'")
    }
}

fn process_mpv_message(msg: String, event_context: &mut EventContext, mpv: &Mpv) {
    let in_msg: InMsg = match serde_json::from_str(&msg) {
        Ok(in_msg) => in_msg,
        Err(error) => {
            eprintln!("cannot parse InMsg:{:?} {error:#}", &msg);
            return;
        }
    };

    let observe = |name: String, format: Format| {
        if let Err(error) = event_context.observe_property(&name, format, 0) {
            eprintln!("cannot observe MPV property {name}: '{error:#}'");
        }
    };

    match in_msg {
        InMsg(InMsgFn::MpvObserveProp, InMsgArgs::ObProp(PropKey::Bool(prop))) => {
            observe(prop.to_string(), Format::Flag);
        }
        InMsg(InMsgFn::MpvObserveProp, InMsgArgs::ObProp(PropKey::Int(prop))) => {
            observe(prop.to_string(), Format::Int64);
        }
        InMsg(InMsgFn::MpvObserveProp, InMsgArgs::ObProp(PropKey::Fp(prop))) => {
            observe(prop.to_string(), Format::Double);
        }
        InMsg(InMsgFn::MpvObserveProp, InMsgArgs::ObProp(PropKey::Str(prop))) => {
            observe(prop.to_string(), Format::String);
        }
        InMsg(InMsgFn::MpvSetProp, InMsgArgs::StProp(name, PropVal::Bool(value))) => {
            set_mpv_property(name, value, mpv);
        }
        InMsg(InMsgFn::MpvSetProp, InMsgArgs::StProp(name, PropVal::Num(value))) => {
            set_mpv_property(name, value, mpv);
        }
        InMsg(InMsgFn::MpvSetProp, InMsgArgs::StProp(name, PropVal::Str(value))) => {
            let value = if name.to_string() == "vo" {
                let mut value = value;
                if !value.is_empty() && !value.ends_with(',') {
                    value.push(',');
                }
                value.push_str("gpu-next,");
                value
            } else {
                value
            };
            set_mpv_property(name, value, mpv);
        }
        InMsg(InMsgFn::MpvCommand, InMsgArgs::Cmd(cmd)) => send_mpv_command(&cmd, mpv),
        msg => eprintln!("MPV unsupported message: '{msg:?}'"),
    }
}

fn create_event_thread(
    mpv: Arc<Mpv>,
    in_msg_receiver: Receiver<String>,
    rpc_response_sender: Sender<String>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        let mut event_context = EventContext::new(mpv.ctx);
        event_context
            .disable_deprecated_events()
            .expect("failed to disable deprecated MPV events");

        for (name, format) in [
            ("time-pos", Format::Double),
            ("duration", Format::Double),
            ("demuxer-cache-time", Format::Double),
        ] {
            event_context
                .observe_property(name, format, 0)
                .expect("failed to observe default MPV property");
        }

        // -- Event handler loop --

        loop {
            // libmpv is explicitly single-threaded. Handle every command and
            // property update on the same thread that drains its event queue;
            // this prevents a source click from deadlocking against wait_event.
            for msg in in_msg_receiver.try_iter() {
                process_mpv_message(msg, &mut event_context, &mpv);
            }

            // A short timeout keeps IPC responsive without calling libmpv from
            // a second thread. Commands are picked up within 100 ms.
            let event = match event_context.wait_event(0.1) {
                Some(Ok(event)) => event,
                Some(Err(error)) => {
                    eprintln!("Event errored: {error:?}");
                    continue;
                }
                // dummy event received (may be created on a wake up call or on timeout)
                None => continue,
            };

            // even if you don't do anything with the events, it is still necessary to empty the event loop
            let player_response = match event {
                Event::PropertyChange { name, change, .. } => PlayerResponse(
                    "mpv-prop-change",
                    PlayerEvent::PropChange(PlayerProprChange::from_name_value(
                        name.to_string(),
                        change,
                    )),
                ),
                Event::EndFile(reason) => PlayerResponse(
                    "mpv-event-ended",
                    PlayerEvent::End(PlayerEnded::from_end_reason(reason)),
                ),
                Event::Shutdown => {
                    break;
                }
                _ => continue,
            };

            rpc_response_sender
                .send(RPCResponse::response_message(player_response.to_value()))
                .expect("failed to send RPCResponse");
        }
    })
}

