import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTheme, type ThemeColors } from "./ui";
import { ClockIcon, ExternalLinkIcon } from "./icons";
import { fetchBlogPosts, type BlogPost } from "@/lib/blog-service";
import { BlogWebViewModal } from "./BlogWebViewModal";

interface BlogCarouselProps {
  onOpenBlogUrl?: (url: string, title?: string) => void;
}

export function BlogCarousel({ onOpenBlogUrl }: BlogCarouselProps) {
  const { colors, isDark } = useTheme();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetchBlogPosts()
      .then((data) => {
        if (active) {
          setPosts(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleOpen = (url: string, title?: string) => {
    if (onOpenBlogUrl) {
      onOpenBlogUrl(url, title);
    } else {
      setActiveUrl(url);
      setActiveTitle(title);
    }
  };

  if (!loading && posts.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Başlık ve Tümünü Gör Butonu */}
      <View style={styles.headerRow}>
        <View style={styles.titleColumn}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Günübirlik Saha Rehberi & Blog
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            Güncel yevmiyeler, haklar ve çalışma rehberleri
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            handleOpen(
              "https://gunubirlik.qrders.com.tr/blog",
              "Günübirlik Rehber & Blog",
            )
          }
          style={[styles.allLink, { backgroundColor: colors.primarySoft }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.allLinkText, { color: colors.primary }]}>Tümü</Text>
          <ExternalLinkIcon size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Yatay Kart Kaydırma Çubuğu */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            Rehber yazıları yükleniyor…
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
        >
          {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              activeOpacity={0.88}
              onPress={() => handleOpen(post.url, post.title)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Görsel */}
              <View style={styles.imageBox}>
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                <View
                  style={[
                    styles.categoryBadge,
                    {
                      backgroundColor: isDark
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(234, 243, 238, 0.95)",
                    },
                  ]}
                >
                  <Text style={[styles.categoryText, { color: colors.primary }]}>
                    {post.category}
                  </Text>
                </View>
              </View>

              {/* Bilgi Alanı */}
              <View style={styles.contentBox}>
                <View style={styles.metaRow}>
                  <View style={styles.metaTimeBox}>
                    <ClockIcon size={11} color={colors.muted} />
                    <Text style={[styles.metaTime, { color: colors.muted }]}>
                      {post.readTime}
                    </Text>
                  </View>
                  <Text style={[styles.metaDate, { color: colors.muted }]}>
                    {post.date}
                  </Text>
                </View>

                <Text
                  style={[styles.postTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {post.title}
                </Text>

                <Text
                  style={[styles.postDesc, { color: colors.muted }]}
                  numberOfLines={2}
                >
                  {post.desc}
                </Text>

                <View style={styles.readMoreRow}>
                  <Text style={[styles.readMoreText, { color: colors.primary }]}>
                    Yazıyı Oku
                  </Text>
                  <ExternalLinkIcon size={12} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Dahili WebView Okuyucu Modalı */}
      {activeUrl && (
        <BlogWebViewModal
          visible={!!activeUrl}
          url={activeUrl}
          title={activeTitle}
          onClose={() => {
            setActiveUrl(null);
            setActiveTitle(undefined);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  allLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  allLinkText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 12,
  },
  card: {
    width: 270,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  imageBox: {
    height: 125,
    width: "100%",
    backgroundColor: "#181C1A",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 9.5,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  contentBox: {
    padding: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaTime: {
    fontSize: 10.5,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  metaDate: {
    fontSize: 10.5,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  postTitle: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    lineHeight: 18,
  },
  postDesc: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_400Regular",
    lineHeight: 16,
  },
  readMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  readMoreText: {
    fontSize: 11.5,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
});
