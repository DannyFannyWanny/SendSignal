import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useStore } from "../store/useStore";

export default function Incoming() {
  const { acceptSignal, rejectSignal } = useStore();
  const sender = { id: "u1", age: 28 };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>You have received a signal</Text>
      <Image source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face" }} style={styles.avatar} />
      <Text style={styles.age}>{sender.age}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.action, { borderColor: "#6B7280", backgroundColor: "#F3F4F6" }]}
          onPress={() => { rejectSignal(sender.id); Alert.alert("Ignored", "No notification is sent to the sender."); }}
        >
          <Text style={{ color: "#6B7280" }}>Ignore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.action, { borderColor: "#20B2AA", backgroundColor: "#20B2AA" }]}
          onPress={() => { acceptSignal(sender.id); Alert.alert("Signal Accepted", "You're good to approach!"); }}
        >
          <Text style={{ fontWeight: "700", color: "white" }}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26, gap: 18 },
  avatar: { width: 132, height: 132, borderRadius: 66, marginVertical: 9 },
  age: { fontSize: 26, fontWeight: "600", textAlign: "center" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  row: { flexDirection: "row", gap: 18, marginTop: 9 },
  action: { paddingVertical: 13, paddingHorizontal: 20, borderWidth: 1, borderRadius: 13 },
});
