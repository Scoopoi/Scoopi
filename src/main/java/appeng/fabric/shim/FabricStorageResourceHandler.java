package appeng.fabric.shim;

import java.util.ArrayList;
import java.util.List;

import net.fabricmc.fabric.api.transfer.v1.storage.SlottedStorage;
import net.fabricmc.fabric.api.transfer.v1.storage.Storage;
import net.fabricmc.fabric.api.transfer.v1.storage.StorageView;
import net.neoforged.neoforge.transfer.ResourceHandler;
import net.neoforged.neoforge.transfer.resource.Resource;
import net.neoforged.neoforge.transfer.transaction.TransactionContext;

/**
 * Exposes a Fabric {@link Storage} as a NeoForge-style {@link ResourceHandler}, so AE2 can interact with vanilla and
 * other Fabric mods' inventories and tanks.
 */
public class FabricStorageResourceHandler<R extends Resource, V> implements ResourceHandler<R> {
    final Storage<V> storage;
    private final ResourceConversion<R, V> conv;

    public FabricStorageResourceHandler(Storage<V> storage, ResourceConversion<R, V> conv) {
        this.storage = storage;
        this.conv = conv;
    }

    private List<StorageView<V>> views() {
        var result = new ArrayList<StorageView<V>>();
        for (var view : storage) {
            result.add(view);
        }
        return result;
    }

    private StorageView<V> view(int index) {
        if (storage instanceof SlottedStorage<V> slotted) {
            return index < slotted.getSlotCount() ? slotted.getSlot(index) : null;
        }
        var views = views();
        return index < views.size() ? views.get(index) : null;
    }

    @Override
    public int size() {
        if (storage instanceof SlottedStorage<V> slotted) {
            return slotted.getSlotCount();
        }
        // Non-slotted storage: expose its current views, plus one virtual "insertion" slot.
        return views().size() + 1;
    }

    @Override
    public R getResource(int index) {
        var view = view(index);
        if (view == null || view.isResourceBlank()) {
            return conv.emptyResource();
        }
        return conv.toResource(view.getResource());
    }

    @Override
    public long getAmountAsLong(int index) {
        var view = view(index);
        return view == null || view.isResourceBlank() ? 0 : conv.toNeoAmount(view.getAmount());
    }

    @Override
    public long getCapacityAsLong(int index, R resource) {
        var view = view(index);
        return view == null ? Integer.MAX_VALUE : conv.toNeoAmount(view.getCapacity());
    }

    @Override
    public boolean isValid(int index, R resource) {
        return storage.supportsInsertion();
    }

    @Override
    public int insert(int index, R resource, int amount, TransactionContext transaction) {
        if (resource.isEmpty() || amount <= 0) {
            return 0;
        }
        var fabricTx = TransactionBridge.toFabric(transaction);
        if (storage instanceof SlottedStorage<V> slotted) {
            if (index >= slotted.getSlotCount()) {
                return 0;
            }
            return (int) conv.toNeoAmount(
                    slotted.getSlot(index).insert(conv.toVariant(resource), conv.toFabricAmount(amount), fabricTx));
        }
        // Non-slotted: route all insertions through the last virtual slot.
        if (index != size() - 1) {
            return 0;
        }
        return insert(resource, amount, transaction);
    }

    @Override
    public int insert(R resource, int amount, TransactionContext transaction) {
        if (resource.isEmpty() || amount <= 0) {
            return 0;
        }
        var fabricTx = TransactionBridge.toFabric(transaction);
        return (int) conv.toNeoAmount(storage.insert(conv.toVariant(resource), conv.toFabricAmount(amount), fabricTx));
    }

    @Override
    public int extract(int index, R resource, int amount, TransactionContext transaction) {
        if (resource.isEmpty() || amount <= 0) {
            return 0;
        }
        var view = view(index);
        if (view == null) {
            return 0;
        }
        var fabricTx = TransactionBridge.toFabric(transaction);
        return (int) conv.toNeoAmount(view.extract(conv.toVariant(resource), conv.toFabricAmount(amount), fabricTx));
    }

    @Override
    public int extract(R resource, int amount, TransactionContext transaction) {
        if (resource.isEmpty() || amount <= 0) {
            return 0;
        }
        var fabricTx = TransactionBridge.toFabric(transaction);
        return (int) conv.toNeoAmount(storage.extract(conv.toVariant(resource), conv.toFabricAmount(amount), fabricTx));
    }
}
