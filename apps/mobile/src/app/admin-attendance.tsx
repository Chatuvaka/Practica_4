import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { router } from "expo-router";

import { supabase } from "../lib/supabase";

type AttendanceType =
  | "entrada"
  | "salida";

type FilterType =
  | "hoy"
  | "7dias"
  | "todos";

type AttendanceRow = {
  id: string;
  user_id: string;
  type: AttendanceType;
  status: string;
  device_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  name: string;
  employee_number: string | null;
};

type AttendanceItem =
  AttendanceRow & {
    userName: string;
    employeeNumber:
      | string
      | null;
  };

export default function AdminAttendanceScreen() {
  const [
    attendance,
    setAttendance,
  ] = useState<
    AttendanceItem[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<FilterType>("hoy");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    verifyAdmin();
  }, []);

  async function verifyAdmin() {
    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      const {
        data: profile,
        error,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        error ||
        !profile ||
        profile.role !== "admin"
      ) {
        router.replace("/home");
        return;
      }

      await loadAttendance();
    } catch (error) {
      console.error(
        "Error verificando administrador:",
        error
      );

      router.replace("/home");
    }
  }

  async function loadAttendance() {
    try {
      setErrorMessage("");

      const {
        data:
          attendanceData,
        error:
          attendanceError,
      } = await supabase
        .from("attendance")
        .select(
          "id, user_id, type, status, device_id, created_at"
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(500);

      if (attendanceError) {
        setErrorMessage(
          attendanceError.message
        );

        return;
      }

      const rows =
        (attendanceData ??
          []) as AttendanceRow[];

      const userIds = [
        ...new Set(
          rows.map(
            (item) =>
              item.user_id
          )
        ),
      ];

      let profiles:
        ProfileRow[] = [];

      if (userIds.length > 0) {
        const {
          data:
            profilesData,
          error:
            profilesError,
        } = await supabase
          .from("profiles")
          .select(
            "id, name, employee_number"
          )
          .in(
            "id",
            userIds
          );

        if (
          profilesError
        ) {
          console.error(
            "Error obteniendo perfiles:",
            profilesError
          );
        } else {
          profiles =
            (profilesData ??
              []) as ProfileRow[];
        }
      }

      const profileMap =
        new Map<
          string,
          ProfileRow
        >();

      profiles.forEach(
        (profile) => {
          profileMap.set(
            profile.id,
            profile
          );
        }
      );

      const result =
        rows.map(
          (item) => {
            const profile =
              profileMap.get(
                item.user_id
              );

            return {
              ...item,

              userName:
                profile?.name ??
                "Usuario desconocido",

              employeeNumber:
                profile?.employee_number ??
                null,
            };
          }
        );

      setAttendance(result);
    } catch (error) {
      console.error(
        "Error cargando historial:",
        error
      );

      setErrorMessage(
        "No fue posible cargar las asistencias."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);

    await loadAttendance();
  }

  const filteredAttendance =
    useMemo(() => {
      const now =
        new Date();

      const todayStart =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

      const sevenDaysAgo =
        new Date(
          todayStart
        );

      sevenDaysAgo.setDate(
        sevenDaysAgo.getDate() -
          6
      );

      const searchValue =
        search
          .trim()
          .toLowerCase();

      return attendance.filter(
        (item) => {
          const itemDate =
            new Date(
              item.created_at
            );

          let validDate =
            true;

          if (
            filter === "hoy"
          ) {
            validDate =
              itemDate >=
              todayStart;
          }

          if (
            filter ===
            "7dias"
          ) {
            validDate =
              itemDate >=
              sevenDaysAgo;
          }

          const validSearch =
            !searchValue ||
            item.userName
              .toLowerCase()
              .includes(
                searchValue
              ) ||
            (
              item.employeeNumber ??
              ""
            )
              .toLowerCase()
              .includes(
                searchValue
              );

          return (
            validDate &&
            validSearch
          );
        }
      );
    }, [
      attendance,
      filter,
      search,
    ]);

  const todayMetrics =
    useMemo(() => {
      const now =
        new Date();

      const start =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

      const today =
        attendance.filter(
          (item) =>
            new Date(
              item.created_at
            ) >= start
        );

      const entries =
        today.filter(
          (item) =>
            item.type ===
            "entrada"
        ).length;

      const exits =
        today.filter(
          (item) =>
            item.type ===
            "salida"
        ).length;

      const uniqueUsers =
        new Set(
          today.map(
            (item) =>
              item.user_id
          )
        ).size;

      return {
        entries,
        exits,
        uniqueUsers,
      };
    }, [attendance]);

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Cargando asistencias...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.header}
      >
        <View>
          <Text
            style={styles.title}
          >
            Asistencias
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Control administrativo
          </Text>
        </View>

        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Volver
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.metricsContainer
        }
      >
        <View
          style={styles.metricCard}
        >
          <Text
            style={styles.metricValue}
          >
            {
              todayMetrics.entries
            }
          </Text>

          <Text
            style={styles.metricLabel}
          >
            Entradas hoy
          </Text>
        </View>

        <View
          style={styles.metricCard}
        >
          <Text
            style={styles.metricValue}
          >
            {todayMetrics.exits}
          </Text>

          <Text
            style={styles.metricLabel}
          >
            Salidas hoy
          </Text>
        </View>

        <View
          style={styles.metricCard}
        >
          <Text
            style={styles.metricValue}
          >
            {
              todayMetrics.uniqueUsers
            }
          </Text>

          <Text
            style={styles.metricLabel}
          >
            Personas hoy
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar usuario o matrícula"
      />

      <View
        style={
          styles.filters
        }
      >
        <Pressable
          style={[
            styles.filterButton,

            filter === "hoy" &&
              styles.filterActive,
          ]}
          onPress={() =>
            setFilter("hoy")
          }
        >
          <Text
            style={[
              styles.filterText,

              filter === "hoy" &&
                styles.filterActiveText,
            ]}
          >
            Hoy
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterButton,

            filter ===
              "7dias" &&
              styles.filterActive,
          ]}
          onPress={() =>
            setFilter(
              "7dias"
            )
          }
        >
          <Text
            style={[
              styles.filterText,

              filter ===
                "7dias" &&
                styles.filterActiveText,
            ]}
          >
            7 días
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.filterButton,

            filter ===
              "todos" &&
              styles.filterActive,
          ]}
          onPress={() =>
            setFilter("todos")
          }
        >
          <Text
            style={[
              styles.filterText,

              filter ===
                "todos" &&
                styles.filterActiveText,
            ]}
          >
            Todos
          </Text>
        </Pressable>
      </View>

      {errorMessage ? (
        <View
          style={styles.errorCard}
        >
          <Text
            style={styles.errorTitle}
          >
            Error
          </Text>

          <Text
            style={styles.errorText}
          >
            {errorMessage}
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            filteredAttendance
          }
          keyExtractor={(item) =>
            item.id
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
            />
          }
          contentContainerStyle={
            styles.list
          }
          ListEmptyComponent={
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Sin registros
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                No hay asistencias
                con estos filtros.
              </Text>
            </View>
          }
          renderItem={({
            item,
          }) => {
            const date =
              new Date(
                item.created_at
              );

            return (
              <View
                style={
                  styles.attendanceCard
                }
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.userName
                      }
                    >
                      {
                        item.userName
                      }
                    </Text>

                    <Text
                      style={
                        styles.employee
                      }
                    >
                      {item.employeeNumber
                        ? `Matrícula: ${item.employeeNumber}`
                        : "Sin matrícula"}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.typeBadge
                    }
                  >
                    <Text
                      style={
                        styles.typeText
                      }
                    >
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View
                  style={
                    styles.details
                  }
                >
                  <Text
                    style={
                      styles.detailText
                    }
                  >
                    {date.toLocaleDateString(
                      "es-MX"
                    )}
                  </Text>

                  <Text
                    style={
                      styles.detailText
                    }
                  >
                    {date.toLocaleTimeString(
                      [],
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit",
                      }
                    )}
                  </Text>

                  <Text
                    style={
                      styles.detailText
                    }
                  >
                    {item.device_id ??
                      "N/A"}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#f5f5f5",
      padding: 18,
    },

    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    loadingText: {
      marginTop: 14,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 18,
    },

    title: {
      fontSize: 28,
      fontWeight: "800",
    },

    subtitle: {
      marginTop: 3,
      color: "#666666",
    },

    backButton: {
      backgroundColor: "#dddddd",
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 10,
    },

    backButtonText: {
      fontWeight: "600",
    },

    metricsContainer: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },

    metricCard: {
      flex: 1,
      backgroundColor: "#ffffff",
      borderRadius: 12,
      padding: 13,
      alignItems: "center",
    },

    metricValue: {
      fontSize: 23,
      fontWeight: "800",
    },

    metricLabel: {
      fontSize: 11,
      textAlign: "center",
      color: "#666666",
      marginTop: 4,
    },

    searchInput: {
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "#dddddd",
      padding: 13,
      borderRadius: 10,
      fontSize: 15,
      marginBottom: 12,
    },

    filters: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },

    filterButton: {
      flex: 1,
      padding: 11,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#cccccc",
      borderRadius: 10,
    },

    filterActive: {
      backgroundColor: "#111111",
      borderColor: "#111111",
    },

    filterText: {
      fontWeight: "600",
    },

    filterActiveText: {
      color: "#ffffff",
    },

    list: {
      paddingBottom: 30,
    },

    attendanceCard: {
      backgroundColor: "#ffffff",
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    },

    cardHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
    },

    userName: {
      fontSize: 18,
      fontWeight: "700",
    },

    employee: {
      marginTop: 4,
      color: "#666666",
      fontSize: 13,
    },

    typeBadge: {
      backgroundColor: "#eeeeee",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
    },

    typeText: {
      fontSize: 11,
      fontWeight: "800",
    },

    details: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginTop: 15,
    },

    detailText: {
      fontSize: 13,
      color: "#555555",
    },

    emptyContainer: {
      alignItems: "center",
      marginTop: 40,
    },

    emptyTitle: {
      fontSize: 19,
      fontWeight: "700",
    },

    emptyText: {
      marginTop: 5,
      color: "#666666",
    },

    errorCard: {
      backgroundColor: "#ffffff",
      padding: 20,
      borderRadius: 14,
    },

    errorTitle: {
      fontSize: 18,
      fontWeight: "700",
    },

    errorText: {
      marginTop: 6,
      color: "#555555",
    },
  });