import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
      />

      <Stack.Screen
        name="register"
      />

      <Stack.Screen
        name="home"
      />

      <Stack.Screen
        name="admin"
      />

      <Stack.Screen
        name="admin-attendance"
      />

      <Stack.Screen
        name="admin-users"
      />

      <Stack.Screen
        name="admin-user-edit"
      />
    </Stack>
  );
}