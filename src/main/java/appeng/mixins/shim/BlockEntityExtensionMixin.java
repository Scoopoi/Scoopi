package appeng.mixins.shim;

import org.spongepowered.asm.mixin.Mixin;

import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.neoforge.common.extensions.IBlockEntityExtension;

@Mixin(BlockEntity.class)
public abstract class BlockEntityExtensionMixin implements IBlockEntityExtension {
    /**
     * Bridges NeoForge's model data to Fabric's block entity render data.
     */
    public Object getRenderData() {
        var data = getModelData();
        return data == net.neoforged.neoforge.model.data.ModelData.EMPTY ? null : data;
    }
}
