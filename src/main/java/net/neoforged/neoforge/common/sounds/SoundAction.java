package net.neoforged.neoforge.common.sounds;

public record SoundAction(String name) {
    public static SoundAction get(String name) {
        return new SoundAction(name);
    }
}
