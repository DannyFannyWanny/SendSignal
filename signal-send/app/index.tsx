import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Modal, Animated } from "react-native";
import { useStore } from "../store/useStore";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";

export default function ScanScreen() {
  const { nearby, me, sendSignal, removeLastSignal, hasSentTo, undoSend } = useStore();
  const list = nearby.filter((u) => u.available && !me.blockedIds.includes(u.id));
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Users</Text>
      
      {/* Navigation Buttons */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push("/incoming")}>
          <View style={styles.buttonContent}>
            <Text style={styles.navButtonText}>Incoming</Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>1</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push("/profile")}>
          <Text style={styles.navButtonText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.photoUrl ?? "https://placehold.co/64x64" }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.age}</Text>
            </View>
            {hasSentTo[item.id] ? (
              <View style={styles.sentPill}>
                <Text style={styles.sentPillText}>✓ Sent</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setSelectedUser(item);
                  setModalVisible(true);
                }}
              >
                <Text style={styles.buttonText}>Send Signal</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      {/* Confirm Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Image 
              source={{ uri: selectedUser?.photoUrl ?? "https://placehold.co/120x120" }} 
              style={styles.modalAvatar} 
            />
            <Text style={styles.modalTitle}>Send Signal?</Text>
            <Text style={styles.modalSubtitle}>You're about to send a signal to someone {selectedUser?.age}</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSend]} 
                onPress={() => {
                  sendSignal(selectedUser.id);
                  setModalVisible(false);
                  setShowUndo(true);
                  
                  // Auto-hide undo after 3 seconds
                  undoTimeoutRef.current = setTimeout(() => {
                    setShowUndo(false);
                  }, 3000);
                }}
              >
                <Text style={styles.modalButtonTextSend}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Snackbar */}
      {showUndo && (
        <View style={styles.undoSnackbar}>
          <Text style={styles.undoText}>Signal sent</Text>
          <TouchableOpacity 
            style={styles.undoButton}
            onPress={() => {
              undoSend(selectedUser.id);
              setShowUndo(false);
              if (undoTimeoutRef.current) {
                clearTimeout(undoTimeoutRef.current);
              }
            }}
          >
            <Text style={styles.undoButtonText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 13 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  navRow: { flexDirection: "row", gap: 13, marginBottom: 18 },
  navButton: { flex: 1, paddingVertical: 13, paddingHorizontal: 18, backgroundColor: "#111", borderRadius: 11, alignItems: "center" },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  navButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
  notificationBadge: { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  notificationText: { color: "white", fontSize: 12, fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", padding: 13, borderRadius: 15, borderWidth: 1, borderColor: "#e5e5e5" },
  avatar: { width: 53, height: 53, borderRadius: 26, marginRight: 13 },
  name: { fontSize: 18, fontWeight: "600" },
  button: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: "#111" },
  buttonText: { fontWeight: "700", fontSize: 16 },
  sentPill: { backgroundColor: "#10B981", paddingVertical: 9, paddingHorizontal: 13, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sentPillText: { color: "white", fontWeight: "700", fontSize: 14 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: "white", borderRadius: 20, padding: 30, alignItems: "center", margin: 20, minWidth: 300 },
  modalAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  modalSubtitle: { fontSize: 16, color: "#666", marginBottom: 25, textAlign: "center" },
  modalButtons: { flexDirection: "row", gap: 15 },
  modalButton: { paddingVertical: 15, paddingHorizontal: 25, borderRadius: 12, minWidth: 100, alignItems: "center" },
  modalButtonCancel: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB" },
  modalButtonSend: { backgroundColor: "#20B2AA" },
  modalButtonTextCancel: { color: "#374151", fontWeight: "600", fontSize: 16 },
  modalButtonTextSend: { color: "white", fontWeight: "700", fontSize: 16 },
  
  // Undo snackbar styles
  undoSnackbar: { 
    position: "absolute", 
    bottom: 30, 
    left: 20, 
    right: 20, 
    backgroundColor: "#111", 
    borderRadius: 12, 
    padding: 16, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  undoText: { color: "white", fontSize: 16, fontWeight: "500" },
  undoButton: { backgroundColor: "#20B2AA", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  undoButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
});
