package appeng.fabric.shim;

import java.util.Iterator;

import net.fabricmc.fabric.api.transfer.v1.storage.SlottedStorage;
import net.fabricmc.fabric.api.transfer.v1.storage.StorageView;
import net.fabricmc.fabric.api.transfer.v1.storage.base.SingleSlotStorage;
import net.fabricmc.fabric.api.transfer.v1.transaction.TransactionContext;
import net.neoforged.neoforge.transfer.ResourceHandler;
import net.neoforged.neoforge.transfer.resource.Resource;

/**
 * Exposes a NeoForge-style {@link ResourceHandler} (AE2's own inventories / tanks / ME interfaces) as a Fabric
 * {@link SlottedStorage}, so hoppers, pipes and other Fabric mods can use it.
 */
public class ResourceHandlerStorage<R extends Resource, V> implements SlottedStorage<V> {
    final ResourceHandler<R> handler;
    private final ResourceConversion<R, V> conv;

    public ResourceHandlerStorage(ResourceHandler<R> handler, ResourceConversion<R, V> conv) {
        this.handler = handler;
        this.conv = conv;
    }

    private static int clampInt(long value) {
        return (int) Math.min(Integer.MAX_VALUE, Math.max(0, value));
    }

    @Override
    public long insert(V resource, long maxAmount, TransactionContext transaction) {
        if (conv.isBlank(resource) || maxAmount <= 0) {
            return 0;
        }
        var neoAmount = clampInt(conv.toNeoAmount(maxAmount));
        if (neoAmount == 0) {
            return 0;
        }
        var neoTx = TransactionBridge.toNeo(transaction);
        return conv.toFabricAmount(handler.insert(conv.toResource(resource), neoAmount, neoTx));
    }

    @Override
    public long extract(V resource, long maxAmount, TransactionContext transaction) {
        if (conv.isBlank(resource) || maxAmount <= 0) {
            return 0;
        }
        var neoAmount = clampInt(conv.toNeoAmount(maxAmount));
        if (neoAmount == 0) {
            return 0;
        }
        var neoTx = TransactionBridge.toNeo(transaction);
        return conv.toFabricAmount(handler.extract(conv.toResource(resource), neoAmount, neoTx));
    }

    @Override
    public int getSlotCount() {
        return handler.size();
    }

    @Override
    public SingleSlotStorage<V> getSlot(int slot) {
        return new Slot(slot);
    }

    @Override
    public Iterator<StorageView<V>> iterator() {
        return new Iterator<>() {
            int index = 0;

            @Override
            public boolean hasNext() {
                return index < handler.size();
            }

            @Override
            public StorageView<V> next() {
                return new Slot(index++);
            }
        };
    }

    private class Slot implements SingleSlotStorage<V> {
        private final int index;

        Slot(int index) {
            this.index = index;
        }

        @Override
        public long insert(V resource, long maxAmount, TransactionContext transaction) {
            if (conv.isBlank(resource) || maxAmount <= 0 || index >= handler.size()) {
                return 0;
            }
            var neoAmount = clampInt(conv.toNeoAmount(maxAmount));
            if (neoAmount == 0) {
                return 0;
            }
            var neoTx = TransactionBridge.toNeo(transaction);
            return conv.toFabricAmount(handler.insert(index, conv.toResource(resource), neoAmount, neoTx));
        }

        @Override
        public long extract(V resource, long maxAmount, TransactionContext transaction) {
            if (conv.isBlank(resource) || maxAmount <= 0 || index >= handler.size()) {
                return 0;
            }
            var neoAmount = clampInt(conv.toNeoAmount(maxAmount));
            if (neoAmount == 0) {
                return 0;
            }
            var neoTx = TransactionBridge.toNeo(transaction);
            return conv.toFabricAmount(handler.extract(index, conv.toResource(resource), neoAmount, neoTx));
        }

        @Override
        public boolean isResourceBlank() {
            return index >= handler.size() || handler.getResource(index).isEmpty()
                    || handler.getAmountAsLong(index) <= 0;
        }

        @Override
        public V getResource() {
            return conv.toVariant(index < handler.size() ? handler.getResource(index) : conv.emptyResource());
        }

        @Override
        public long getAmount() {
            return index < handler.size() ? conv.toFabricAmount(handler.getAmountAsLong(index)) : 0;
        }

        @Override
        public long getCapacity() {
            if (index >= handler.size()) {
                return 0;
            }
            return conv.toFabricAmount(handler.getCapacityAsLong(index, handler.getResource(index)));
        }
    }
}
