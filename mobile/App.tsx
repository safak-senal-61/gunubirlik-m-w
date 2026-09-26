// GİRİŞ NOKTASI (package.json "main": "App.tsx")
// Android release build'inde "main" bileşeninin AÇIKÇA kaydedilmesi şart:
// aksi halde "Invariant Violation: main has not been registered" ile uygulama
// açılışta çöker (beyaz ekran / anında kapanma). Gerçek uygulama RealApp.tsx'te.

import { registerRootComponent } from "expo";
import RealApp from "./RealApp";

registerRootComponent(RealApp);
