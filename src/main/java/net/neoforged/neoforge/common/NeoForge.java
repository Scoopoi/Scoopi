package net.neoforged.neoforge.common;

import net.neoforged.bus.api.IEventBus;

import appeng.fabric.shim.SimpleEventBus;

public final class NeoForge {
    /** The game event bus. Events are fired into it from Fabric callbacks by {@code appeng.fabric.FabricEventBridge}. */
    public static final IEventBus EVENT_BUS = new SimpleEventBus("game");

    private NeoForge() {
    }
}
