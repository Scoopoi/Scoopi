package net.neoforged.fml.util.thread;

/** On Fabric the server thread is not placed in this group; use appeng.util.Platform helpers instead. */
public final class SidedThreadGroups {
    public static final ThreadGroup SERVER = new ThreadGroup("SERVER");

    private SidedThreadGroups() {
    }
}
