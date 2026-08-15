import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { colors, fonts, fontSize } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-screen">
        <Text style={styles.logo}>MoneySeeker</Text>
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)/search" : "/login"} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  logo: { fontFamily: fonts.bold, fontSize: fontSize.xxl, color: colors.brandPrimary, letterSpacing: -0.5 },
});
