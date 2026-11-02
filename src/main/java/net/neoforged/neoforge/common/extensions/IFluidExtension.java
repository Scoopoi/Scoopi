package net.neoforged.neoforge.common.extensions;

import net.minecraft.world.level.material.Fluid;
import net.neoforged.neoforge.fluids.FluidType;

/** Injected into {@link Fluid}. */
public interface IFluidExtension {
    default FluidType getFluidType() {
        return FluidType.of((Fluid) this);
    }
}
