package appeng.fabric.client;

import net.fabricmc.fabric.api.transfer.v1.client.fluid.FluidVariantRendering;
import net.fabricmc.fabric.api.transfer.v1.fluid.FluidVariant;
import net.neoforged.neoforge.fluids.FluidStack;

/** Client helpers replacing NeoForge client extensions. */
public final class ShimClientRendering {
    private ShimClientRendering() {
    }

    public static int fluidColor(FluidStack stack) {
        if (stack.isEmpty()) {
            return 0xFFFFFFFF;
        }
        return FluidVariantRendering.getColor(FluidVariant.of(stack.getFluid(), stack.getComponentsPatch()))
                | 0xFF000000;
    }
}
