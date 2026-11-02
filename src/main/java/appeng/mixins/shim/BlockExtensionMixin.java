package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.common.extensions.IBlockExtension;

@Mixin(Block.class)
public abstract class BlockExtensionMixin implements IBlockExtension {
}
