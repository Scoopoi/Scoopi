package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.client.renderer.block.dispatch.BlockStateModel;
import net.neoforged.neoforge.client.extensions.IBlockStateModelExtension;

@Mixin(BlockStateModel.class)
public interface BlockStateModelExtensionMixin extends IBlockStateModelExtension {
}
