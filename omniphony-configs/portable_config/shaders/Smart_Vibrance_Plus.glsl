//!BUFFER SVP_STATE
//!VAR float pprev_scene_activity
//!VAR float pprev_micro_activity
//!VAR uint pprev_frame_count
//!STORAGE

//!HOOK OUTPUT
//!BIND HOOKED
//!SAVE SVP_BASE
//!DESC Smart Vibrance Plus source latch
vec4 hook()
{
    return HOOKED_tex(HOOKED_pos);
}

//!HOOK OUTPUT
//!BIND HOOKED
//!BIND SVP_STATE
//!DESC Smart Vibrance Plus temporal

float smart_vibrance_sigmoid(float x)
{
    return 1.0 / (1.0 + exp(-x));
}

float smart_vibrance_ema(float prev, float current, float lambda)
{
    float a = 1.0 - exp(-lambda);
    return mix(prev, current, a);
}

vec3 smart_vibrance_adjust(vec3 color, float intensity, float sceneActivity)
{
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 chroma = color - vec3(luminance);

    float chromaEnergy = dot(chroma, chroma);
    float chromaMag = sqrt(max(chromaEnergy, 0.0));

    float satRef = mix(0.35, 0.65, sceneActivity);
    float grayRef = mix(0.006, 0.0015, sceneActivity);

    float normSat = clamp(chromaMag / satRef, 0.0, 1.0);
    float rolloff = 1.0 - normSat;
    float graySoft = smart_vibrance_sigmoid((grayRef - chromaEnergy) * 45.0);

    float response = mix(rolloff, 1.0, graySoft);
    float gain = (intensity - 1.0) * response;

    return vec3(luminance) + chroma + chroma * gain;
}

vec4 hook()
{
    vec4 inputColor = HOOKED_tex(HOOKED_pos);
    vec3 color = inputColor.rgb;

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 chroma = color - vec3(luminance);
    float chromaEnergy = dot(chroma, chroma);

    float sceneActivityRaw = clamp(chromaEnergy * 10.0, 0.0, 1.0);
    float sceneActivity = smart_vibrance_ema(pprev_scene_activity, sceneActivityRaw, 0.08);
    float microActivity = smart_vibrance_ema(pprev_micro_activity, chromaEnergy, 0.25);
    float stabilityBoost = 1.0 - clamp(microActivity * 5.0, 0.0, 1.0);
    float intensity = 2.0 * mix(0.85, 1.0, sceneActivity) * stabilityBoost;

    vec3 outColor = smart_vibrance_adjust(color, intensity, sceneActivity);
    return vec4(clamp(outColor, 0.0, 1.0), inputColor.a);
}

//!HOOK OUTPUT
//!BIND SVP_BASE
//!BIND SVP_STATE
//!SAVE EMPTY
//!WIDTH 1
//!HEIGHT 1
//!COMPUTE 1 1
//!DESC Smart Vibrance Plus temporal state update
void hook()
{
    vec4 inputColor = SVP_BASE_tex(vec2(0.5, 0.5));
    vec3 color = inputColor.rgb;

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 chroma = color - vec3(luminance);
    float chromaEnergy = dot(chroma, chroma);
    float sceneActivityRaw = clamp(chromaEnergy * 10.0, 0.0, 1.0);

    pprev_scene_activity = mix(pprev_scene_activity, sceneActivityRaw, 1.0 - exp(-0.08));
    pprev_micro_activity = mix(pprev_micro_activity, chromaEnergy, 1.0 - exp(-0.25));
    pprev_frame_count = pprev_frame_count + 1u;
}
