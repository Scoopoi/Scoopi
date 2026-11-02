package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.common.extensions.IItemStackExtension;

@Mixin(ItemStack.class)
public abstract class ItemStackExtensionMixin implements IItemStackExtension {
}
