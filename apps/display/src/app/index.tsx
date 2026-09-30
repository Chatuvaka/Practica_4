import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { supabase } from "../lib/supabase";

type AttendanceType = "entrada" | "salida";

type AttendanceEvent = {
  id: string;
  user_id: string;
  type: AttendanceType;
  status: string;
  created_at: string;
};

type WelcomeData = {
  name: string;
  type: AttendanceType;
  createdAt: string;
};

type Announcement = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  expires_at: string | null;
};

type DayStats = {
  entradas: number;
  salidas: number;
};

export default function SmartDisplayScreen() {
  const { width, height } = useWindowDimensions();

  const isPortrait = height > width;
  const isSmallScreen = width < 700;

  const [loading, setLoading] = useState(true);

  const [connectionStatus, setConnectionStatus] =
    useState("Conectando...");

  const [welcome, setWelcome] =
    useState<WelcomeData | null>(null);

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [now, setNow] = useState(new Date());

  const [lastMovement, setLastMovement] =
    useState<WelcomeData | null>(null);

  const [dayStats, setDayStats] =
    useState<DayStats>({
      entradas: 0,
      salidas: 0,
    });

  const timeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initializeDisplay() {
      try {
        setConnectionStatus(
          "Conectando con el sistema..."
        );

        const email =
          process.env.EXPO_PUBLIC_DISPLAY_EMAIL;

        const password =
          process.env.EXPO_PUBLIC_DISPLAY_PASSWORD;

        if (!email || !password) {
          throw new Error(
            "Faltan credenciales de Display"
          );
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          const { error } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (error) {
            throw error;
          }
        }

        if (!mounted) {
          return;
        }

        await Promise.all([
          loadAnnouncements(),
          loadTodayStats(),
          loadLastMovement(),
        ]);

        subscribeToAttendance();
        subscribeToAnnouncements();

        setConnectionStatus("Sistema en línea");
        setLoading(false);
      } catch (error) {
        console.error(
          "Error inicializando Display:",
          error
        );

        if (mounted) {
          setConnectionStatus(
            "Error de conexión"
          );

          setLoading(false);
        }
      }
    }

    async function loadAnnouncements() {
      const { data, error } =
        await supabase
          .from("announcements")
          .select(
            "id, title, description, active, expires_at"
          )
          .eq("active", true)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "Error cargando avisos:",
          error
        );

        return;
      }

      setAnnouncements(
        (data ?? []) as Announcement[]
      );
    }

    async function loadTodayStats() {
      const start = new Date();

      start.setHours(0, 0, 0, 0);

      const { data, error } =
        await supabase
          .from("attendance")
          .select("type")
          .gte(
            "created_at",
            start.toISOString()
          );

      if (error) {
        console.error(
          "Error cargando estadísticas:",
          error
        );

        return;
      }

      const entradas =
        data?.filter(
          (item) =>
            item.type === "entrada"
        ).length ?? 0;

      const salidas =
        data?.filter(
          (item) =>
            item.type === "salida"
        ).length ?? 0;

      setDayStats({
        entradas,
        salidas,
      });
    }

    async function loadLastMovement() {
      const { data, error } =
        await supabase
          .from("attendance")
          .select(
            "user_id, type, created_at"
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (error || !data) {
        return;
      }

      const {
        data: profile,
      } = await supabase
        .from("profiles")
        .select("name")
        .eq(
          "id",
          data.user_id
        )
        .single();

      setLastMovement({
        name:
          profile?.name ??
          "Usuario",

        type:
          data.type as AttendanceType,

        createdAt:
          data.created_at,
      });
    }

    function subscribeToAttendance() {
      supabase
        .channel(
          "smart-display-attendance"
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "attendance",
          },
          async (payload) => {
            const attendance =
              payload.new as AttendanceEvent;

            await showWelcome(
              attendance
            );

            await loadTodayStats();
          }
        )
        .subscribe((status) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            setConnectionStatus(
              "Sistema en línea"
            );
          }

          if (
            status ===
            "CHANNEL_ERROR"
          ) {
            setConnectionStatus(
              "Error de conexión"
            );
          }
        });
    }

    function subscribeToAnnouncements() {
      supabase
        .channel(
          "smart-display-announcements"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "announcements",
          },
          async () => {
            await loadAnnouncements();
          }
        )
        .subscribe();
    }

    async function showWelcome(
      attendance: AttendanceEvent
    ) {
      const {
        data: profile,
      } = await supabase
        .from("profiles")
        .select("name")
        .eq(
          "id",
          attendance.user_id
        )
        .single();

      const data: WelcomeData = {
        name:
          profile?.name ??
          "Usuario",

        type:
          attendance.type,

        createdAt:
          attendance.created_at,
      };

      setWelcome(data);
      setLastMovement(data);

      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }

      timeoutRef.current =
        setTimeout(() => {
          setWelcome(null);
        }, 5000);
    }

    initializeDisplay();

    return () => {
      mounted = false;

      if (timeoutRef.current) {
        clearTimeout(
          timeoutRef.current
        );
      }

      supabase.removeAllChannels();
    };
  }, []);

  const formattedTime =
    useMemo(() => {
      return now.toLocaleTimeString(
        "es-MX",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    }, [now]);

  const formattedDate =
    useMemo(() => {
      return now.toLocaleDateString(
        "es-MX",
        {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      );
    }, [now]);

  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <View
          style={styles.loadingCard}
        >
          <ActivityIndicator
            size="large"
          />

          <Text
            style={styles.loadingTitle}
          >
            Checador Inteligente
          </Text>

          <Text
            style={styles.loadingText}
          >
            {connectionStatus}
          </Text>
        </View>
      </View>
    );
  }

  if (welcome) {
    const isEntry =
      welcome.type === "entrada";

    const time =
      new Date(
        welcome.createdAt
      ).toLocaleTimeString(
        "es-MX",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    return (
      <View
        style={styles.welcomeScreen}
      >
        <View
          style={[
            styles.welcomeCircle,
            isSmallScreen &&
              styles.welcomeCircleSmall,
          ]}
        >
          <Text
            style={[
              styles.check,
              isSmallScreen &&
                styles.checkSmall,
            ]}
          >
            ✓
          </Text>
        </View>

        <Text
          style={[
            styles.welcomeLabel,
            isSmallScreen &&
              styles.welcomeLabelSmall,
          ]}
        >
          {isEntry
            ? "BIENVENIDO"
            : "HASTA LUEGO"}
        </Text>

        <Text
          style={[
            styles.welcomeName,
            isSmallScreen &&
              styles.welcomeNameSmall,
          ]}
          numberOfLines={2}
        >
          {welcome.name}
        </Text>

        <View
          style={
            styles.welcomeDivider
          }
        />

        <Text
          style={[
            styles.welcomeAction,
            isSmallScreen &&
              styles.welcomeActionSmall,
          ]}
        >
          {isEntry
            ? "Entrada registrada correctamente"
            : "Salida registrada correctamente"}
        </Text>

        <Text
          style={[
            styles.welcomeTime,
            isSmallScreen &&
              styles.welcomeTimeSmall,
          ]}
        >
          {time}
        </Text>
      </View>
    );
  }

  const lastMovementTime =
    lastMovement
      ? new Date(
          lastMovement.createdAt
        ).toLocaleTimeString(
          "es-MX",
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        )
      : "--:--";

  return (
    <View
      style={[
        styles.screen,
        isSmallScreen &&
          styles.screenSmall,
      ]}
    >
      <View
        style={[
          styles.header,
          isPortrait &&
            styles.headerPortrait,
        ]}
      >
        <View
          style={[
            styles.brandContainer,
            isPortrait &&
              styles.brandContainerPortrait,
          ]}
        >
          <View
            style={[
              styles.brandMark,
              isSmallScreen &&
                styles.brandMarkSmall,
            ]}
          >
            <Text
              style={[
                styles.brandMarkText,
                isSmallScreen &&
                  styles.brandMarkTextSmall,
              ]}
            >
              CI
            </Text>
          </View>

          <View
            style={
              styles.brandTextContainer
            }
          >
            <Text
              style={[
                styles.brand,
                isSmallScreen &&
                  styles.brandSmall,
              ]}
              numberOfLines={1}
            >
              Checador Inteligente
            </Text>

            <Text
              style={[
                styles.date,
                isSmallScreen &&
                  styles.dateSmall,
              ]}
              numberOfLines={1}
            >
              {formattedDate}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.clockArea,
            isPortrait &&
              styles.clockAreaPortrait,
          ]}
        >
          <Text
            style={[
              styles.clock,
              isSmallScreen &&
                styles.clockSmall,
            ]}
          >
            {formattedTime}
          </Text>

          <View
            style={
              styles.connectionRow
            }
          >
            <View
              style={styles.onlineDot}
            />

            <Text
              style={[
                styles.connectionText,
                isSmallScreen &&
                  styles.connectionTextSmall,
              ]}
              numberOfLines={1}
            >
              {connectionStatus}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.body,
          isPortrait &&
            styles.bodyPortrait,
        ]}
      >
        <View
          style={[
            styles.announcementsPanel,
            isPortrait &&
              styles.announcementsPanelPortrait,
          ]}
        >
          <View
            style={
              styles.panelHeader
            }
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.panelEyebrow
                }
              >
                INFORMACIÓN
              </Text>

              <Text
                style={[
                  styles.panelTitle,
                  isSmallScreen &&
                    styles.panelTitleSmall,
                ]}
                numberOfLines={2}
              >
                Avisos importantes
              </Text>
            </View>

            <View
              style={
                styles.countBadge
              }
            >
              <Text
                style={
                  styles.countBadgeText
                }
              >
                {
                  announcements.length
                }
              </Text>
            </View>
          </View>

          {announcements.length ===
          0 ? (
            <View
              style={
                styles.emptyState
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Text
                  style={
                    styles.emptyIconText
                  }
                >
                  i
                </Text>
              </View>

              <Text
                style={[
                  styles.emptyTitle,
                  isSmallScreen &&
                    styles.emptyTitleSmall,
                ]}
              >
                Sin avisos activos
              </Text>

              <Text
                style={[
                  styles.emptyDescription,
                  isSmallScreen &&
                    styles.emptyDescriptionSmall,
                ]}
              >
                Los avisos publicados
                aparecerán aquí
                automáticamente.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.announcementList
              }
            >
              {announcements.map(
                (
                  announcement,
                  index
                ) => (
                  <View
                    key={
                      announcement.id
                    }
                    style={
                      styles.announcementCard
                    }
                  >
                    <View
                      style={
                        styles.announcementNumber
                      }
                    >
                      <Text
                        style={
                          styles.announcementNumberText
                        }
                      >
                        {index + 1}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.announcementContent
                      }
                    >
                      <Text
                        style={[
                          styles.announcementTitle,
                          isSmallScreen &&
                            styles.announcementTitleSmall,
                        ]}
                      >
                        {
                          announcement.title
                        }
                      </Text>

                      {announcement.description && (
                        <Text
                          style={[
                            styles.announcementDescription,
                            isSmallScreen &&
                              styles.announcementDescriptionSmall,
                          ]}
                        >
                          {
                            announcement.description
                          }
                        </Text>
                      )}
                    </View>
                  </View>
                )
              )}
            </ScrollView>
          )}
        </View>

        <View
          style={[
            styles.sidePanel,
            isPortrait &&
              styles.sidePanelPortrait,
          ]}
        >
          <View
            style={[
              styles.statsCard,
              isPortrait &&
                styles.portraitInfoCard,
            ]}
          >
            <Text
              style={
                styles.sideEyebrow
              }
            >
              RESUMEN DE HOY
            </Text>

            {!isPortrait && (
              <Text
                style={
                  styles.sideTitle
                }
              >
                Asistencias
              </Text>
            )}

            <View
              style={[
                styles.statRow,
                isPortrait &&
                  styles.statRowPortrait,
              ]}
            >
              <View
                style={
                  styles.statBlock
                }
              >
                <Text
                  style={[
                    styles.statNumber,
                    isSmallScreen &&
                      styles.statNumberSmall,
                  ]}
                >
                  {
                    dayStats.entradas
                  }
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Entradas
                </Text>
              </View>

              <View
                style={
                  styles.statDivider
                }
              />

              <View
                style={
                  styles.statBlock
                }
              >
                <Text
                  style={[
                    styles.statNumber,
                    isSmallScreen &&
                      styles.statNumberSmall,
                  ]}
                >
                  {dayStats.salidas}
                </Text>

                <Text
                  style={
                    styles.statLabel
                  }
                >
                  Salidas
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.lastMovementCard,
              isPortrait &&
                styles.portraitInfoCard,
            ]}
          >
            <Text
              style={
                styles.sideEyebrow
              }
            >
              ÚLTIMO REGISTRO
            </Text>

            {lastMovement ? (
              <>
                <Text
                  style={[
                    styles.lastMovementName,
                    isSmallScreen &&
                      styles.lastMovementNameSmall,
                  ]}
                  numberOfLines={2}
                >
                  {
                    lastMovement.name
                  }
                </Text>

                <View
                  style={
                    styles.movementBadge
                  }
                >
                  <Text
                    style={
                      styles.movementBadgeText
                    }
                  >
                    {lastMovement.type.toUpperCase()}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.lastMovementTime,
                    isSmallScreen &&
                      styles.lastMovementTimeSmall,
                  ]}
                >
                  {
                    lastMovementTime
                  }
                </Text>
              </>
            ) : (
              <Text
                style={
                  styles.noMovement
                }
              >
                Sin registros
              </Text>
            )}
          </View>

          <View
            style={[
              styles.systemCard,
              isPortrait &&
                styles.portraitInfoCard,
            ]}
          >
            <View
              style={
                styles.systemRow
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.systemLabel
                  }
                >
                  ESTADO DEL SISTEMA
                </Text>

                <Text
                  style={[
                    styles.systemValue,
                    isSmallScreen &&
                      styles.systemValueSmall,
                  ]}
                >
                  Operativo
                </Text>
              </View>

              <View
                style={
                  styles.statusIcon
                }
              >
                <Text
                  style={
                    styles.statusIconText
                  }
                >
                  ✓
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {!isSmallScreen && (
        <View
          style={styles.footer}
        >
          <Text
            style={styles.footerText}
          >
            Sistema de Control de
            Asistencia
          </Text>

          <Text
            style={
              styles.footerSecondary
            }
          >
            Smart Display •
            Sincronización en tiempo
            real
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef1f4",
    paddingHorizontal: 34,
    paddingTop: 26,
    paddingBottom: 18,
  },

  screenSmall: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#eef1f4",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 50,
    paddingVertical: 40,
    alignItems: "center",
  },

  loadingTitle: {
    marginTop: 20,
    fontSize: 26,
    fontWeight: "800",
  },

  loadingText: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 16,
  },

  header: {
    minHeight: 92,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  headerPortrait: {
    minHeight: 0,
    alignItems: "flex-start",
    marginBottom: 16,
  },

  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  brandContainerPortrait: {
    paddingRight: 10,
  },

  brandTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  brandMark: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#171717",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  brandMarkSmall: {
    width: 46,
    height: 46,
    borderRadius: 13,
    marginRight: 11,
  },

  brandMarkText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
  },

  brandMarkTextSmall: {
    fontSize: 16,
  },

  brand: {
    fontSize: 29,
    fontWeight: "900",
    color: "#171717",
  },

  brandSmall: {
    fontSize: 21,
  },

  date: {
    marginTop: 5,
    fontSize: 16,
    color: "#68707a",
    textTransform: "capitalize",
  },

  dateSmall: {
    fontSize: 12,
  },

  clockArea: {
    alignItems: "flex-end",
    marginLeft: 20,
  },

  clockAreaPortrait: {
    marginLeft: 8,
  },

  clock: {
    fontSize: 43,
    fontWeight: "900",
    color: "#171717",
  },

  clockSmall: {
    fontSize: 27,
  },

  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#222222",
    marginRight: 8,
  },

  connectionText: {
    fontSize: 13,
    color: "#68707a",
    fontWeight: "600",
  },

  connectionTextSmall: {
    fontSize: 10,
  },

  body: {
    flex: 1,
    flexDirection: "row",
  },

  bodyPortrait: {
    flexDirection: "column",
  },

  announcementsPanel: {
    flex: 2.35,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 26,
    marginRight: 20,
  },

  announcementsPanelPortrait: {
    flex: 1,
    marginRight: 0,
    marginBottom: 14,
    padding: 20,
    minHeight: 300,
  },

  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  panelEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800",
    color: "#8a9199",
  },

  panelTitle: {
    marginTop: 5,
    fontSize: 25,
    fontWeight: "900",
    color: "#171717",
  },

  panelTitleSmall: {
    fontSize: 22,
  },

  countBadge: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#f0f1f3",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  countBadgeText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#242424",
  },

  announcementList: {
    paddingBottom: 10,
  },

  announcementCard: {
    flexDirection: "row",
    backgroundColor: "#f6f7f8",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },

  announcementNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },

  announcementNumberText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },

  announcementContent: {
    flex: 1,
  },

  announcementTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1d1d1f",
  },

  announcementTitleSmall: {
    fontSize: 17,
  },

  announcementDescription: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: "#62676e",
  },

  announcementDescriptionSmall: {
    fontSize: 13,
    lineHeight: 18,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#f0f1f3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  emptyIconText: {
    fontSize: 25,
    fontWeight: "900",
    color: "#62676e",
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#232323",
    textAlign: "center",
  },

  emptyTitleSmall: {
    fontSize: 19,
  },

  emptyDescription: {
    marginTop: 7,
    fontSize: 15,
    color: "#7a8087",
    textAlign: "center",
  },

  emptyDescriptionSmall: {
    fontSize: 13,
  },

  sidePanel: {
    flex: 1,
  },

  sidePanelPortrait: {
    flex: 0,
    flexDirection: "row",
  },

  portraitInfoCard: {
    flex: 1,
    marginBottom: 0,
    marginRight: 8,
    minWidth: 0,
  },

  statsCard: {
    backgroundColor: "#171717",
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
  },

  sideEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    color: "#8b9198",
  },

  sideTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 5,
    marginBottom: 20,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statRowPortrait: {
    marginTop: 12,
  },

  statBlock: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },

  statNumber: {
    fontSize: 35,
    fontWeight: "900",
    color: "#ffffff",
  },

  statNumberSmall: {
    fontSize: 25,
  },

  statLabel: {
    marginTop: 3,
    color: "#b8bdc3",
    fontSize: 12,
    textAlign: "center",
  },

  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#3b3b3b",
  },

  lastMovementCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 22,
    marginBottom: 16,
  },

  lastMovementName: {
    marginTop: 14,
    fontSize: 25,
    fontWeight: "900",
    color: "#202020",
  },

  lastMovementNameSmall: {
    fontSize: 18,
  },

  movementBadge: {
    alignSelf: "flex-start",
    marginTop: 13,
    backgroundColor: "#ededed",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },

  movementBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  lastMovementTime: {
    marginTop: 15,
    fontSize: 28,
    fontWeight: "800",
    color: "#4d5359",
  },

  lastMovementTimeSmall: {
    fontSize: 20,
  },

  noMovement: {
    marginTop: 20,
    fontSize: 20,
    color: "#777777",
    fontWeight: "600",
  },

  systemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 20,
  },

  systemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  systemLabel: {
    fontSize: 10,
    color: "#8b9198",
    fontWeight: "800",
    letterSpacing: 1.1,
  },

  systemValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f1f1f",
  },

  systemValueSmall: {
    fontSize: 15,
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#ededed",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  statusIconText: {
    fontSize: 20,
    fontWeight: "900",
  },

  footer: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 12,
  },

  footerText: {
    fontSize: 13,
    color: "#646a70",
    fontWeight: "600",
  },

  footerSecondary: {
    fontSize: 12,
    color: "#8c9298",
  },

  welcomeScreen: {
    flex: 1,
    backgroundColor: "#f6f7f8",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  welcomeCircle: {
    width: 100,
    height: 100,
    borderRadius: 32,
    backgroundColor: "#171717",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },

  welcomeCircleSmall: {
    width: 76,
    height: 76,
    borderRadius: 24,
    marginBottom: 22,
  },

  check: {
    fontSize: 55,
    color: "#ffffff",
    fontWeight: "900",
  },

  checkSmall: {
    fontSize: 40,
  },

  welcomeLabel: {
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#6b7076",
  },

  welcomeLabelSmall: {
    fontSize: 18,
    letterSpacing: 2,
  },

  welcomeName: {
    marginTop: 12,
    fontSize: 58,
    fontWeight: "900",
    color: "#161616",
    maxWidth: "90%",
    textAlign: "center",
  },

  welcomeNameSmall: {
    fontSize: 38,
  },

  welcomeDivider: {
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#222222",
    marginVertical: 24,
  },

  welcomeAction: {
    fontSize: 23,
    color: "#4f555b",
    fontWeight: "600",
    textAlign: "center",
  },

  welcomeActionSmall: {
    fontSize: 17,
  },

  welcomeTime: {
    marginTop: 8,
    fontSize: 31,
    fontWeight: "900",
    color: "#202020",
  },

  welcomeTimeSmall: {
    fontSize: 24,
  },
});