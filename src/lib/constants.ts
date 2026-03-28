// Hand landmark indices (MediaPipe standard)
export const THUMB_TIP_INDEX = 4;
export const INDEX_FINGER_TIP_INDEX = 8;
export const WRIST_INDEX = 0;
export const MIDDLE_FINGER_MCP_INDEX = 9;

// Drawing
export const PINCH_RATIO_THRESHOLD = 0.35;
export const SMOOTHING_FACTOR = 0.3;
export const MIN_POINTS_FOR_BALLOON = 6;
export const MIN_POINT_DISTANCE = 3;
export const DRAWING_ANIMATION_PERIOD = 70;
export const DRAWING_ANIMATION_AMPLITUDE = 0.04;
export const WAVE_PERIOD = 220;
export const WAVE_DEPTH_RATIO = 0.22;
export const PINCH_RELEASE_GRACE_MS = 300;

// Physics
export const GRAVITY = 900;
export const FALL_DAMPING = 0.9;
export const MAX_FRAME_TIME_SECONDS = 0.033;
export const AIR_DRAG = 3.6;
export const MAX_FALL_SPEED = 180;
export const SWAY_FREQUENCY = 1.3;
export const SWAY_STRENGTH = 24;
export const LATERAL_DAMPING = 3.2;
export const SETTLED_LATERAL_DAMPING = 5.2;
export const GROUND_RESTITUTION = 0.28;
export const QUICK_BOUNCE_DAMPING = 0.45;
export const COLLISION_PUSH_FORCE = 26;
export const TOPPLE_TORQUE_SCALE = 0.006;
export const TOPPLE_DAMPING = 2.8;
export const MAX_TOPPLE_ANGULAR_SPEED = 1.4;
export const CONTACT_THRESHOLD_Y = 8;
export const MIN_TOPPLE_OFFSET = 2;
export const MIN_BOUNCE_FACTOR = 0.2;
export const MIN_ANGULAR_VELOCITY = 0.01;
export const TOPPLE_STOP_THRESHOLD = 0.03;
export const SETTLEMENT_VELOCITY_Y = 12;
export const SETTLEMENT_LATERAL_SPEED = 8;
export const SETTLEMENT_BOUNCE_THRESHOLD = 0.25;
export const BOUNCE_STOP_SPEED = 8;
export const MULTI_CONTACT_THRESHOLD = 5;
export const FALL_STRETCH_DIVISOR = 2000;
export const MAX_FALL_STRETCH = 0.08;
export const WALL_PADDING_XY = 10;
export const WALL_PADDING_Z = 25;
export const WALL_RESTITUTION = 0.28;
export const RANDOM_COLLISION_VELOCITY = 6;
export const EXTERNAL_WAKE_SPEED = 26;
export const SETTLE_CONFIRM_FRAMES = 12;
export const ENDPOINT_SETTLE_MULTIPLIER = 1.6;
export const ENDPOINT_CONTACT_SETTLE_THRESHOLD = CONTACT_THRESHOLD_Y * ENDPOINT_SETTLE_MULTIPLIER;
// Slightly larger spacing keeps settled balloons visually separated instead of intersecting.
export const COLLISION_SPACING_MULTIPLIER = 2.2;
// A settled balloon should wake up from weaker collision impulse than direct wind wake.
export const COLLISION_WAKE_SCALE = 0.45;
export const COLLISION_WAKE_THRESHOLD = EXTERNAL_WAKE_SPEED * COLLISION_WAKE_SCALE;

// Geometry
export const END_CAP_PROTRUSION = 1.12;
export const END_CAP_WIDTH_SEGMENTS = 20;
export const END_CAP_HEIGHT_SEGMENTS = 16;
export const BALLOON_DEFAULT_RADIUS = 11;
export const BALLOON_RADIUS_VARIANCE = 4;

// Wind
export const GLOBAL_WIND_DECAY = 2.4;
export const GESTURE_WIND_MULTIPLIER = 10;
export const MAX_GESTURE_WIND = 360;
export const GESTURE_WAVE_TO_WIND = 0.2;
export const MAX_GESTURE_WIND_DELTA = 80;
export const OPEN_PALM_POSE_BIAS = 10;
export const GESTURE_WIND_BLEND_RATE = 7;
export const SCALED_MAX_GESTURE_WIND = MAX_GESTURE_WIND * GESTURE_WIND_MULTIPLIER;
export const SCALED_MAX_GESTURE_WIND_DELTA = MAX_GESTURE_WIND_DELTA * GESTURE_WIND_MULTIPLIER;
export const SCALED_GESTURE_WAVE_TO_WIND = GESTURE_WAVE_TO_WIND * GESTURE_WIND_MULTIPLIER;
export const SCALED_OPEN_PALM_POSE_BIAS = OPEN_PALM_POSE_BIAS * GESTURE_WIND_MULTIPLIER;
export const SCALED_MAX_GESTURE_VERTICAL_WIND = SCALED_MAX_GESTURE_WIND * 0.35;
export const SCALED_MAX_GESTURE_VERTICAL_WIND_DELTA = SCALED_MAX_GESTURE_WIND_DELTA * 0.35;
export const SCALED_OPEN_PALM_POSE_BIAS_Y = SCALED_OPEN_PALM_POSE_BIAS * 0.35;
export const SCALED_MAX_GESTURE_DEPTH_WIND = SCALED_MAX_GESTURE_WIND * 0.3;
export const SCALED_MAX_GESTURE_DEPTH_WIND_DELTA = SCALED_MAX_GESTURE_WIND_DELTA * 0.3;
export const SCALED_OPEN_PALM_POSE_BIAS_Z = SCALED_OPEN_PALM_POSE_BIAS * 0.3;

// Gesture names
export const OPEN_PALM_GESTURES = ["Open_Palm", "OpenPalm"];
export const FIST_GESTURES = ["Closed_Fist", "Fist"];
export const THEME_TOGGLE_GESTURES = ["Victory", "Thumb_Up", "Thumbs_Up", "ThumbUp"];

// Hold gesture
export const GESTURE_HOLD_CONFIRM_MS = 3000;
export const GESTURE_HOLD_JITTER_GRACE_MS = 180;
export const JITTER_GRACE_SECONDS_TEXT = (GESTURE_HOLD_JITTER_GRACE_MS / 1000).toFixed(2);
