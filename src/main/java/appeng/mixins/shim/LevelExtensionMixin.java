package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.level.Level;
import net.neoforged.neoforge.common.extensions.ILevelExtension;

@Mixin(Level.class)
public abstract class LevelExtensionMixin implements ILevelExtension {
}
