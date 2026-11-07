package com.scoopi.creepertackle;

/** Duck interface implemented on CreeperEntity via mixin. */
public interface TackleableCreeper {
    /** A defused creeper can never explode again. Saved to NBT. */
    boolean creepertackle$isDefused();

    /** Ticks left that the creeper is pinned to the ground. */
    int creepertackle$getStunTicks();

    /** Pin the creeper down for {@code stunTicks} and permanently defuse it. */
    void creepertackle$tackle(int stunTicks);
}
