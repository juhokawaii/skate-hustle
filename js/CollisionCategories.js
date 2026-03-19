// Fixed collision category bitmasks shared across all scenes.
// Using static values avoids the Matter.Body._nextCategory global counter,
// which overflows after ~32 scene transitions and breaks collision detection.
export const CATS = {
    GROUND:  0x0002,
    ONE_WAY: 0x0004,
    PLAYER:  0x0008,
    SENSOR:  0x0010
};
