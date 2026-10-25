const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../src/screens/ProfileScreen.tsx");
let s = fs.readFileSync(filePath, "utf8");

s = s.replace('<Text style={{ fontSize: 26 }}>📎</Text>', '<Text style={{ fontSize: 13, fontWeight: "700", color: C.primary }}>Belge Yüklendi</Text>');
s = s.replace('? "🚫 Hesabın kalıcı olarak askıya alınmış. Destekle iletişime geç."', '? "Hesabınız askıya alınmıştır. Lütfen destek ekibiyle iletişime geçiniz."');
s = s.replace(': `⏸️ Hesabın ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleDateString("tr-TR") : "belirsiz"} tarihine kadar askıda.`}', ': `Hesabınız ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleDateString("tr-TR") : "belirsiz"} tarihine kadar askıya alınmıştır.`}');
s = s.replace('<Text style={styles.pwIcon}>{isGoogle ? "🔑" : "🛡️"}</Text>', '<LockIcon size={20} color={C.primary} />');
s = s.replace('<Text style={{ fontSize: 22 }}>{pending ? "⏳" : "🗑️"}</Text>', '<TrashIcon size={20} color={pending ? C.amber : C.danger} />');

fs.writeFileSync(filePath, s, "utf8");
console.log("Remaining 4 emojis cleaned!");
