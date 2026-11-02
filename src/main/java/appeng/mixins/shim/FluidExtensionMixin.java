package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.level.material.Fluid;
import net.neoforged.neoforge.common.extensions.IFluidExtension;

@Mixin(Fluid.class)
public abstract class FluidExtensionMixin implements IFluidExtension {
}
