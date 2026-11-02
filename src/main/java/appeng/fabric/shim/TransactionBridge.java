package appeng.fabric.shim;

import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;

import net.fabricmc.fabric.api.transfer.v1.transaction.Transaction;
import net.neoforged.neoforge.transfer.transaction.TransactionContext;

/**
 * Mirrors NeoForge-style transactions (used by AE2 internally) onto Fabric Transfer API transactions and vice versa.
 * <p>
 * Neo -> Fabric: when AE2 talks to a Fabric {@code Storage} inside a Neo transaction of depth d, we lazily open a
 * Fabric transaction that is closed (committed/aborted) when the Neo transaction closes.
 * <p>
 * Fabric -> Neo: when a Fabric mod talks to an AE2 handler inside a Fabric transaction, we lazily open a Neo
 * transaction that is closed from the Fabric transaction's close callback.
 */
public final class TransactionBridge {
    private TransactionBridge() {
    }

    private static final class State {
        /** Fabric transactions opened on behalf of Neo transactions, in nesting order. */
        final List<Entry> neoToFabric = new ArrayList<>();
        /** Neo transactions opened on behalf of Fabric transactions. */
        final Map<net.fabricmc.fabric.api.transfer.v1.transaction.TransactionContext, net.neoforged.neoforge.transfer.transaction.Transaction> fabricToNeo = new IdentityHashMap<>();
    }

    private record Entry(TransactionContext neo, Transaction fabric) {
    }

    private static final ThreadLocal<State> STATE = ThreadLocal.withInitial(State::new);

    /**
     * Get (or open) the Fabric transaction mirroring the given Neo transaction.
     */
    public static net.fabricmc.fabric.api.transfer.v1.transaction.TransactionContext toFabric(TransactionContext neo) {
        var state = STATE.get();
        // Was this Neo transaction itself opened on behalf of a Fabric transaction? Then use that one.
        for (var e : state.fabricToNeo.entrySet()) {
            if (e.getValue() == neo) {
                return e.getKey();
            }
        }
        for (var entry : state.neoToFabric) {
            if (entry.neo == neo) {
                return entry.fabric;
            }
        }
        var current = Transaction.getCurrentUnsafe();
        var fabric = current == null ? Transaction.openOuter() : Transaction.openNested(current);
        state.neoToFabric.add(new Entry(neo, fabric));
        return fabric;
    }

    /** Called by the (patched) Neo transaction right before it closes. */
    public static void onNeoClose(TransactionContext neo, boolean aborted) {
        var state = STATE.get();
        var list = state.neoToFabric;
        for (int i = list.size() - 1; i >= 0; i--) {
            var entry = list.get(i);
            if (entry.neo == neo) {
                list.remove(i);
                if (entry.fabric.isOpen()) {
                    if (aborted) {
                        entry.fabric.abort();
                    } else {
                        entry.fabric.commit();
                    }
                }
                return;
            }
        }
    }

    /**
     * Get (or open) the Neo transaction mirroring the given Fabric transaction.
     */
    public static TransactionContext toNeo(net.fabricmc.fabric.api.transfer.v1.transaction.TransactionContext fabric) {
        var state = STATE.get();
        // If the Fabric transaction was opened on behalf of a Neo transaction, use the Neo one directly.
        for (var entry : state.neoToFabric) {
            if (entry.fabric == fabric) {
                return entry.neo;
            }
        }
        var existing = state.fabricToNeo.get(fabric);
        if (existing != null) {
            return existing;
        }
        @SuppressWarnings("deprecation")
        var parent = net.neoforged.neoforge.transfer.transaction.Transaction.getCurrentOpenedTransaction();
        var neo = net.neoforged.neoforge.transfer.transaction.Transaction.open(parent);
        state.fabricToNeo.put(fabric, neo);
        fabric.addCloseCallback((ctx, result) -> {
            var s = STATE.get();
            var tx = s.fabricToNeo.remove(fabric);
            if (tx != null) {
                if (result.wasCommitted()) {
                    tx.commit();
                } else {
                    tx.close();
                }
            }
        });
        return neo;
    }
}
