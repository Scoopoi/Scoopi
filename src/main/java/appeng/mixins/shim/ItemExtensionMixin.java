package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.item.Item;
import net.neoforged.neoforge.common.extensions.IItemExtension;

@Mixin(Item.class)
public abstract class ItemExtensionMixin implements IItemExtension {
}
