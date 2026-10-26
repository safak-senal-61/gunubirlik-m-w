export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  desc: string;
  imageUrl: string;
  date: string;
  readTime: string;
  category: string;
  url: string;
}

export const FALLBACK_BLOG_POSTS: BlogPost[] = [
  {
    id: "2026-gunluk-yevmiye-ucretleri-ve-piyasa-rehberi",
    slug: "2026-gunluk-yevmiye-ucretleri-ve-piyasa-rehberi",
    title: "2026 Günlük Yevmiye Fiyatları: Garson, Temizlik, İnşaat ve Kurye Rehberi",
    desc: "Türkiye genelinde 2026 yılı güncel yevmiye tarifeleri ne kadar? Şehirlere ve mesleklere göre ortalama günlük ücretler, yol/yemek hakları ve piyasa analizi.",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
    date: "2026-10-15",
    readTime: "6 dk okuma",
    category: "YEVMIYE REHBERI",
    url: "https://gunubirlik.qrders.com.tr/blog/2026-gunluk-yevmiye-ucretleri-ve-piyasa-rehberi",
  },
  {
    id: "part-time-vs-gunubirlik-is-hangisi-daha-karli",
    slug: "part-time-vs-gunubirlik-is-hangisi-daha-karli",
    title: "Part-Time İş mi, Günübirlik Yevmiyeli İş mi? Kazanç ve Esneklik Karşılaştırması",
    desc: "Aylık sabit maaşlı part-time bir işte çalışmak mı, yoksa haftalık günübirlik yevmiyeli işler seçmek mi daha avantajlı? Kapsamlı analiz.",
    imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
    date: "2026-10-21",
    readTime: "4 dk okuma",
    category: "KARŞILAŞTIRMA",
    url: "https://gunubirlik.qrders.com.tr/blog/part-time-vs-gunubirlik-is-hangisi-daha-karli",
  },
  {
    id: "yevmiyeli-calisanlarin-haklari-ve-emanet-odeme-sistemi",
    slug: "yevmiyeli-calisanlarin-haklari-ve-emanet-odeme-sistemi",
    title: "Günübirlik Çalışanların Hakları ve Güvenli Emanet Ödeme Sistemi Nedir?",
    desc: "Günübirlik çalışanların yasal hakları, sigorta uygulamaları ve Günübirlik Emanet Sistemi ile çalışan güvenliğinin nasıl sağlandığı hakkında detaylı kılavuz.",
    imageUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80",
    date: "2026-10-20",
    readTime: "5 dk okuma",
    category: "HAKLAR VE GÜVENLİK",
    url: "https://gunubirlik.qrders.com.tr/blog/yevmiyeli-calisanlarin-haklari-ve-emanet-odeme-sistemi",
  },
  {
    id: "isverenler-icin-acil-yevmiyeli-eleman-bulma-rehberi",
    slug: "isverenler-icin-acil-yevmiyeli-eleman-bulma-rehberi",
    title: "Acil Eleman Lazım Olduğunda Aynı Gün Güvenilir İşçi Bulma Yöntemleri",
    desc: "Personeliniz son dakika gelmediğinde veya ani bir iş yoğunluğu oluştuğunda 30 dakika içinde nasıl güvenilir usta ve eleman bulabilirsiniz?",
    imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    date: "2026-10-19",
    readTime: "4 dk okuma",
    category: "İŞVEREN REHBERİ",
    url: "https://gunubirlik.qrders.com.tr/blog/isverenler-icin-acil-yevmiyeli-eleman-bulma-rehberi",
  },
  {
    id: "ogrenciler-icin-gunubirlik-is-bulma-tuyolari",
    slug: "ogrenciler-icin-gunubirlik-is-bulma-tuyolari",
    title: "Üniversite Öğrencileri İçin Hafta Sonu ve Boş Günlerde Ek Gelir Rehberi",
    desc: "Ders programınızı aksatmadan harçlığınızı çıkarabileceğiniz en popüler günlük işler, zaman yönetimi ve güvenli iş bulma yolları.",
    imageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
    date: "2026-10-18",
    readTime: "5 dk okuma",
    category: "ÖĞRENCİ REHBERİ",
    url: "https://gunubirlik.qrders.com.tr/blog/ogrenciler-icin-gunubirlik-is-bulma-tuyolari",
  },
];

let inMemoryBlogCache: BlogPost[] | null = null;

/**
 * https://gunubirlik.qrders.com.tr/blog sayfasından en güncel blog yazılarını çeker.
 * Ağ hatasında veya bağlantı kesintisinde önbelleğe alınmış zengin içeriği anında döner.
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  if (inMemoryBlogCache && inMemoryBlogCache.length > 0) {
    return inMemoryBlogCache;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://gunubirlik.qrders.com.tr/blog", {
      headers: {
        "User-Agent": "GunubirlikMobileApp/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      inMemoryBlogCache = FALLBACK_BLOG_POSTS;
      return FALLBACK_BLOG_POSTS;
    }

    const html = await res.text();
    const articleRegex = /<article[\s\S]*?<\/article>/gi;
    const matches = html.match(articleRegex) || [];

    if (matches.length === 0) {
      inMemoryBlogCache = FALLBACK_BLOG_POSTS;
      return FALLBACK_BLOG_POSTS;
    }

    const posts: BlogPost[] = matches.map((item, idx) => {
      const imgMatch = item.match(/<img[^>]+src=["']([^"']+)["']/i);
      const linkMatch = item.match(/href=["']\/blog\/([^"']+)["']/i);
      const titleMatch = item.match(/<h[23][^>]*>(.*?)<\/h[23]>/i);
      const descMatch = item.match(/<p[^>]*>(.*?)<\/p>/i);
      const dateMatch = item.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      const readTimeMatch = item.match(/([0-9]+\s*dk\s*okuma)/i);
      const badgeMatch = item.match(/font-semibold["']>([^<]+)<\/span>/i);

      const title = titleMatch
        ? titleMatch[1].replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "").trim()
        : "";
      const desc = descMatch
        ? descMatch[1].replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "").trim()
        : "";
      const slug = linkMatch ? linkMatch[1] : "";
      const imageUrl = imgMatch ? imgMatch[1].replace(/&amp;/g, "&") : "";
      const date = dateMatch ? dateMatch[1] : "";
      const readTime = readTimeMatch ? readTimeMatch[1] : "4 dk okuma";
      const category = badgeMatch
        ? badgeMatch[1].replace(/<!--.*?-->/g, "").replace(/[•\s]+/g, " ").trim()
        : "REHBER";

      return {
        id: slug || `post-${idx}`,
        slug,
        title,
        desc,
        imageUrl,
        date,
        readTime,
        category,
        url: `https://gunubirlik.qrders.com.tr/blog/${slug}`,
      };
    }).filter((p) => p.title && p.slug);

    if (posts.length > 0) {
      inMemoryBlogCache = posts;
      return posts;
    }

    inMemoryBlogCache = FALLBACK_BLOG_POSTS;
    return FALLBACK_BLOG_POSTS;
  } catch {
    inMemoryBlogCache = FALLBACK_BLOG_POSTS;
    return FALLBACK_BLOG_POSTS;
  }
}
