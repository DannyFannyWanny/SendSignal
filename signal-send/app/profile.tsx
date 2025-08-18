import { View, Text, Switch, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useStore } from "../store/useStore";

export default function Profile() {
  const { me, setAvailable, hideProfile } = useStore();

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: me.photoUrl ?? "https://placehold.co/120x120" }} style={styles.avatar} />
      <Text style={styles.name}>{me.name}</Text>
      {me.age ? <Text style={{ color: "#666" }}>{me.age}</Text> : null}
      
      <Text style={styles.signalsRemaining}>Daily Signals Remaining: 1</Text>

      <View style={styles.row}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>Available</Text>
        <Switch value={me.available} onValueChange={setAvailable} />
      </View>

      <TouchableOpacity style={styles.hide} onPress={hideProfile}>
        <Text style={{ fontWeight: "700" }}>Hide Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", padding: 26, gap: 13 },
  avatar: { width: 132, height: 132, borderRadius: 66, marginVertical: 9 },
  name: { fontSize: 24, fontWeight: "800" },
  signalsRemaining: { fontSize: 18, fontWeight: "600", color: "#666", textAlign: "center" },
  row: { width: "100%", marginTop: 13, padding: 18, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hide: { marginTop: 18, paddingVertical: 13, paddingHorizontal: 20, borderWidth: 1, borderRadius: 13, borderColor: "#111" },
});
