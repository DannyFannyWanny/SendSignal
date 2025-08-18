import { create } from "zustand";

export type User = {
  id: string;
  name?: string;
  age?: number;
  photoUrl?: string;
  available: boolean;
  blockedIds: string[];
};

export type NearbyUser = { id: string; name?: string; age?: number; photoUrl?: string; available: boolean; };
type Signal = { id: string; senderId: string; receiverId: string; status: "sent" | "accepted" | "rejected" };
type State = {
  me: User;
  nearby: NearbyUser[];
  signals: Signal[];
  hasSentTo: Record<string, boolean>;
  setAvailable: (v: boolean) => void;
  sendSignal: (receiverId: string) => void;
  removeLastSignal: () => void;
  undoSend: (receiverId: string) => void;
  acceptSignal: (senderId: string) => void;
  rejectSignal: (senderId: string) => void;
  blockUser: (blockedId: string) => void;
  hideProfile: () => void;
};

export const useStore = create<State>((set, get) => ({
  me: { id: "me", name: "You", age: 27, available: false, blockedIds: [], photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
  nearby: [
    { id: "u1", age: 28, available: true, photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face" },
    { id: "u2", age: 26, available: true, photoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" },
    { id: "u3", age: 30, available: true, photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face" },
    { id: "u4", age: 24, available: true, photoUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face" },
    { id: "u5", age: 32, available: true, photoUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&h=150&fit=crop&crop=face" },
  ],
  signals: [],
  hasSentTo: {},
  setAvailable: (v) => set((s) => ({ me: { ...s.me, available: v } })),
  sendSignal: (receiverId) =>
    set((s) => ({ 
      signals: [...s.signals, { id: Date.now().toString(), senderId: s.me.id, receiverId, status: "sent" }],
      hasSentTo: { ...s.hasSentTo, [receiverId]: true }
    })),
  removeLastSignal: () =>
    set((s) => ({ signals: s.signals.slice(0, -1) })),
  undoSend: (receiverId) =>
    set((s) => ({ 
      signals: s.signals.slice(0, -1),
      hasSentTo: { ...s.hasSentTo, [receiverId]: false }
    })),
  acceptSignal: (senderId) =>
    set((s) => ({ signals: s.signals.map((sig) => sig.senderId === senderId ? { ...sig, status: "accepted" } : sig) })),
  rejectSignal: (senderId) =>
    set((s) => ({ signals: s.signals.map((sig) => sig.senderId === senderId ? { ...sig, status: "rejected" } : sig) })),
  blockUser: (blockedId) => set((s) => ({ me: { ...s.me, blockedIds: [...s.me.blockedIds, blockedId] }, nearby: s.nearby.filter((u) => u.id !== blockedId) })),
  hideProfile: () => set((s) => ({ me: { ...s.me, available: false } })),
}));
