/**
 * Günübirlik Elastic & Fuzzy Search Engine
 * Türkçe karakter normalizasyonu, çoklu alan ağırlıklandırma,
 * kök ve ön ek (stemming) eşleştirmesi, Levenshtein mesafe toleransı.
 */

import type { ApiJob } from './types';

/**
 * Türkçe karakterleri ASCII denklerine dönüştürür ve küçük harfe çevirir.
 */
export function normalizeTurkish(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein mesafesi — yazım hataları toleransı için (Örn: "restorant" -> "restoran")
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // değiştirme
          matrix[i][j - 1] + 1,     // ekleme
          matrix[i - 1][j] + 1      // silme
        );
      }
    }
  }

  return matrix[bn][an];
}

export interface ElasticSearchParams {
  query: string;
  category?: string;
  city?: string;
}

/**
 * Günübirlik Elastic İş Arama Fonksiyonu
 */
export function elasticSearchJobs(
  jobs: ApiJob[],
  params: ElasticSearchParams
): ApiJob[] {
  const { query, category, city } = params;
  const normalizedQuery = normalizeTurkish(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 0);

  // Filtre uygulanmadıysa ve sorgu boşsa tüm ilanları dön
  if (!normalizedQuery && (!category || category === 'all') && (!city || city === 'all')) {
    return jobs;
  }

  const scored = jobs.map((job) => {
    // Kategori filtresi
    if (category && category !== 'all' && job.category !== category) {
      return { job, score: -1 };
    }

    // Şehir filtresi
    if (city && city !== 'all') {
      const normJobCity = normalizeTurkish(job.city);
      const normFilterCity = normalizeTurkish(city);
      if (!normJobCity.includes(normFilterCity)) {
        return { job, score: -1 };
      }
    }

    // Yalnızca filtre varsa ve arama terimi yoksa
    if (queryTokens.length === 0) {
      return { job, score: 50 };
    }

    const normTitle = normalizeTurkish(job.title || '');
    const normDesc = normalizeTurkish(job.description || '');
    const normCity = normalizeTurkish(job.city || '');
    const normDistrict = normalizeTurkish(job.district || '');
    const normCategory = normalizeTurkish(job.category || '');

    let score = 0;

    // 1. Tam İfade Eşleşmesi (Tam Cümle / Kelime Öbeği)
    if (normTitle.includes(normalizedQuery)) score += 120;
    if (normDistrict.includes(normalizedQuery)) score += 70;
    if (normCity.includes(normalizedQuery)) score += 40;
    if (normCategory.includes(normalizedQuery)) score += 50;
    if (normDesc.includes(normalizedQuery)) score += 30;

    // Başlık tam aramayla başlıyorsa ekstra bonus
    if (normTitle.startsWith(normalizedQuery)) score += 40;

    // 2. Token Bazlı Analiz (Her Kelime Ayrı Ayrı)
    for (const token of queryTokens) {
      let tokenMatched = false;

      // Başlıkta tam kelime veya alt dize
      if (normTitle.includes(token)) {
        score += 50;
        tokenMatched = true;
      }
      // İlçe eşleşmesi (Örn: Kadıköy, Çankaya)
      if (normDistrict.includes(token)) {
        score += 35;
        tokenMatched = true;
      }
      // Şehir eşleşmesi (Örn: İstanbul, Ankara)
      if (normCity.includes(token)) {
        score += 25;
        tokenMatched = true;
      }
      // Kategori eşleşmesi (Örn: İnşaat, Garson)
      if (normCategory.includes(token)) {
        score += 30;
        tokenMatched = true;
      }
      // Açıklama eşleşmesi
      if (normDesc.includes(token)) {
        score += 15;
        tokenMatched = true;
      }

      // 3. Kök / Ön Ek (Stemming) Eşleşmesi (Örn: "boyaci" -> "boya", "temizlk" -> "temizlik")
      if (!tokenMatched && token.length >= 4) {
        const prefix4 = token.slice(0, 4);
        if (normTitle.includes(prefix4)) {
          score += 35;
          tokenMatched = true;
        } else if (normCategory.includes(prefix4)) {
          score += 25;
          tokenMatched = true;
        } else if (normDistrict.includes(prefix4)) {
          score += 20;
          tokenMatched = true;
        }
      }

      // 4. Fuzzy / Levenshtein Yazım Hatası Toleransı
      if (!tokenMatched && token.length >= 3) {
        const titleWords = normTitle.split(/\s+/);
        for (const tw of titleWords) {
          if (tw.length >= 3) {
            const dist = levenshteinDistance(token, tw);
            if (dist <= 1) {
              score += 25;
              tokenMatched = true;
              break;
            } else if (dist <= 2 && token.length >= 5) {
              score += 15;
              tokenMatched = true;
              break;
            }
          }
        }
      }

      // Eşleşmeyen token için hafif puan kır
      if (!tokenMatched) {
        score -= 10;
      }
    }

    return { job, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.job);
}
