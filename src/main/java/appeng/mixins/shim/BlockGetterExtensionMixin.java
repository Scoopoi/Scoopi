package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.level.BlockGetter;
import net.neoforged.neoforge.common.extensions.IBlockGetterExtension;

@Mixin(BlockGetter.class)
public interface BlockGetterExtensionMixin extends IBlockGetterExtension {
}
