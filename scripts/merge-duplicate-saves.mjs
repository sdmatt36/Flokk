/**
 * Merge duplicate SavedItem rows for familyProfileId cmmmv15y7000104jvocfz5kt6.
 *
 * For each of 126 duplicate groups (rawTitle + destinationCity):
 *   - KEEP = oldest row by savedAt
 *   - DUP  = carries a tripId (and in 2 cases a shareToken) the keep row lacks
 *   - Operation: copy the unique association onto the keep row, then soft-delete the dup
 *
 * NEVER hard-deletes. Scoped strictly to familyProfileId cmmmv15y7000104jvocfz5kt6.
 * Reversible: set deletedAt = NULL on any dup id to restore; manually null the copied
 * field on the keep row if needed.
 *
 * Generated from Part 1 analysis (126 clean-merge, 0 conflicts, 0 soft-delete-only).
 */

import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.production") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const FAMILY_PROFILE_ID = "cmmmv15y7000104jvocfz5kt6";

// [keep_id, {col: value, ...}, dup_id, rawTitle, destCity]
const MERGE_OPS = [
  ["cmo533y5r000304l2w5dn698r", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1066eo001c04jrjia17h84", "AniTouch", "Tokyo"],
  ["cmo5azkjz000304jrqgzcoupx", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp10659p000304jr1xw0sr5j", "Ao Nui Bay", "Koh Lanta"],
  ["cmo530rmq000wlrrq6kozjquw", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp10662q000z04jrx4zj90cy", "Arashiyama Bamboo Forest", "Kyoto"],
  ["cmp4kw6ox000j04jprz2foqiv", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000j04kw2pvbymci", "Arena México", "Mexico City"],
  ["cmo5356oi003plrrqxobc0jxc", {"tripId": "cmnqv13gr000404lfv4metkkj"}, "cmp1066gh001e04jrj1efulog", "Au Khe - Lau Thai", "Ha Long Bay"],
  ["cmo5pg1mc000804l7wpwit801", {"tripId": "cmo2xj2du000004l8k08yyn0i"}, "cmp1067sc002w04jrfixy5s40", "AWkitchen GARDEN", "Kamakura"],
  ["cmo534zmz003jlrrq2g5muwmf", {"tripId": "cmnqv13gr000404lfv4metkkj"}, "cmp1066i8001g04jrop0t4w6i", "Bai Dinh", "Ha Long Bay"],
  ["cmo533xco000e04jr3dvif9oe", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp10663l001004jrjbqfgv32", "Batting Cages", "Tokyo"],
  ["cmo5p0nqj000a04lav9yq7b0b", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp1065fa000904jrunen8y1u", "Benchakitti Park", "Bangkok"],
  ["cmo536im6000b04ib8p4nqe5a", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067e5002g04jroj7ammg1", "Blue Coffee", "Chiang Mai"],
  ["cmp4kw6ox000904jph8m1f1rq", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000904kwbb3bop05", "Bosque de Chapultepec rowboat rentals", "Mexico City"],
  ["cmo58omuh000e04l16dwgwkpb", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066yb001y04jrumcqawo5", "Bread Street Kitchen & Bar", "Dubai"],
  ["cmo536ift000705jvroraf7fv", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1068mv003t04jrsrwh6trg", "Bua Tong Waterfall", "Chiang Mai"],
  ["cmo5359ox003slrrq9r93wh9s", {"tripId": "cmnqv13gr000404lfv4metkkj"}, "cmp1066q7001p04jr8xnoqghy", "Buffalo Cave", "Ha Long Bay"],
  ["cmo58on3x000304joobbnvuxp", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066hc001f04jrasx8bi04", "Burj Khalifa", "Dubai"],
  ["cmo5308bq000hlrrqmw2ck12b", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp106769002704jrdk5x3zrx", "Busan X The Sky", "Busan"],
  ["cmp4kw6ow000304jpv5blgzzs", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000304kwac34peco", "Café de Tacuba", "Mexico City"],
  ["cmo53032v000glrrq5crwwcme", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1069gz004r04jr6ykg85pz", "Cat Cafe Myeongdong", "Seoul"],
  ["cmo5p0omv000304kz33cokv2j", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp10667e001404jr4husccn3", "Chakkraphat Phiman Palace", "Bangkok"],
  ["cmo5301vh000flrrqit7fuufl", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1068ba003g04jr70suuzyq", "Chakraa Indian Restaurant", "Seoul"],
  ["cmp4kw6ox000704jpbub43tut", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000704kwokgo22ua", "Chapultepec Zoo", "Mexico City"],
  ["cmo536ix3000b04jmg85az32i", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1065q8000l04jr0bf1jw2q", "Chiang Mai Night Bazaar", "Chiang Mai"],
  ["cmo536ivj000804iijb4a4vch", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1065r3000m04jr4fv2smi4", "Chiang Mai Night Market", "Chiang Mai"],
  ["cmo59jdf4000304jjgc53dz6m", {"tripId": "cmmy95w8b000004l5l8rd4e01"}, "cmp1068ih003o04jruo5fb676", "Chiang Rai Night Market", "Chiang Rai"],
  ["cmo5p0omw000304jr7h47zztb", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp1065up000q04jrdtvvntyh", "Chinatown Food Tour", "Bangkok"],
  ["cmo52zz94000dlrrq2swbrxwv", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1068t4004004jrb3cwctg8", "Cloud Mipo", "Busan"],
  ["cmo5309mw000ilrrqhd5puy58", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1068pk003w04jrlxgwhzr9", "Coex Mall Exploring", "Seoul"],
  ["cmoxtztc0000304ky48wsg6ts", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp1068c7003h04jr0m34djn7", "Cucina Serale", "Onna"],
  ["cmo530ufa000ylrrq2yn1cuhg", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1066b0001804jrxc6pkjqt", "Dinner at Yorozuya", "Kyoto"],
  ["cmo58ommn000604l1983ot6mn", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066vo001v04jr3uy84s13", "Dubai Mall", "Dubai"],
  ["cmp4kw6ox000504jpo4o0ymq1", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000504kwhewtyr1o", "El Moro Churrería", "Mexico City"],
  ["cmo530o75000tlrrqlu7tgwow", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp10697e004g04jrk6esm8pi", "Fushimi Inari Shrine", "Kyoto"],
  ["cmo530azy000jlrrquhbgbalv", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1068s8003z04jr99r1hnrk", "Gamcheon Culture Village", "Busan"],
  ["cmo530k8e000plrrqivcwh2fq", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1066mo001l04jrp58ildae", "Gion District", "Kyoto"],
  ["cmo58onhr000304l4f1mtgfz4", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066j3001h04jrb3i32e75", "Global Village", "Dubai"],
  ["cmo530lfz000qlrrq683mkw14", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp10668a001504jrujiz42wv", "Golden Palace", "Kyoto"],
  ["cmo59jd2n000504kyuvp6d2g4", {"tripId": "cmmy95w8b000004l5l8rd4e01"}, "cmp1068vr004304jr3aiv1lbo", "Golden Triangle", "Chiang Rai"],
  ["cmo58onpm000304jx7jr1ej68", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066xg001x04jralh61g54", "Gordon Ramsay's Street Pizza", "Dubai"],
  ["cmo530f9c000llrrqzrl1e722", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1066ls001k04jryyci2nnw", "Grand Children's Park Seoul", "Seoul"],
  ["cmo530e51000klrrqw1g2gc7s", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1068u0004104jr9iomvw1t", "Haeundae Beach", "Busan"],
  ["cmo52zncu0009lrrq04devri3", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp10685v003a04jry8c5nnuh", "Haeundae Traditional Market", "Busan"],
  ["cmp4kw6ox000d04jpd14tdne0", {"tripId": "cmp4kyn21000004kwlahvdbz1", "shareToken": "T1eaDdSz4alL"}, "cmp4kyn54000d04kwgy4869tw", "Helados Siberia", "Mexico City"],
  ["cmo533xac000h04l2apye7y7e", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1068za004704jr0tjqqe65", "Hibiya Park", "Tokyo"],
  ["cmo533y4q000304l8gd6ig5wj", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069kh004v04jrf25ztdhx", "Hitachino Brewing Marunouchi", "Tokyo"],
  ["cmo53535y003mlrrq3rbcdepw", {"tripId": "cmnqv13gr000404lfv4metkkj"}, "cmp1067ka002n04jram1uhcdl", "Hoa Lu", "Ha Long Bay"],
  ["cmo58ommq000704l1b6scv7or", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066st001s04jr88vp1hal", "HuQQabaz Jumeirah", "Dubai"],
  ["cmo533y4l000304jrgbk2iovw", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069ed004o04jr7t03rak7", "Imperial Palace Tokyo", "Tokyo"],
  ["cmp4kw6ox000c04jptaq9yy5h", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000c04kwnkmnyacl", "Jardín Centenario and Parque de Coyoacán", "Mexico City"],
  ["cmo58onfo000304l5kqsoclt1", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066ty001t04jrjs912t0i", "Jumarai Beach", "Dubai"],
  ["cmo533x8g000504kwt71rwps0", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069n3004y04jr8iohjj78", "Kagurazaka Yamase", "Tokyo"],
  ["cmo5azk1l000404ikn138ga9z", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp1068xk004504jrwcb02crf", "Khlong Dao Beach", "Koh Lanta"],
  ["cmo5p0olu000304jmw48rpypv", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp1066jz001i04jrjcalv8pm", "King Power Mahanakhon", "Bangkok"],
  ["cmo536igv000704kzrvcmjgr9", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1068lz003s04jrbhid02e5", "Kingkong Smile Zipline", "Chiang Mai"],
  ["cmo5azl0t000304lahb7zo6b2", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp1065ch000604jrwt9nsvou", "Koh Lanta Old Town", "Koh Lanta"],
  ["cmo5azl2c000304l1xgtgiw14", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp1065df000704jr9nqosyrx", "Koh Rok & Koh Haa One Day Tour", "Koh Lanta"],
  ["cmp4kw6ox000g04jpycplqo4m", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000g04kwhdyhb0ky", "La Gruta Restaurant", "Mexico City"],
  ["cmo536iev000704ibmuf7qdx3", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp106781002904jr5qgefe62", "Lan Po Muay Thai", "Chiang Mai"],
  ["cmo5azk6i000904l5plhqkc2t", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp1065am000404jr557tyu7o", "Lanta Riviera Beach Resort Thailand", "Koh Lanta"],
  ["cmo52zoh2000alrrqgaqb6hxb", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1067u3002y04jrhgj1vqf2", "LG Twins", "Seoul"],
  ["cmo5p0olo000304jri7ps6i0h", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp10661s000y04jrvz73mf51", "Longtail Boat Canal Cruise", "Bangkok"],
  ["cmo52zkhp0008lrrq4m1uorn3", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp10686s003b04jru2wemuup", "Lotte Giants Baseball Game", "Busan"],
  ["cmo5p0oky000304l1xttu6171", {"tripId": "cmo0tcd05000004l1adf7tt8c", "shareToken": "44_oSWUZJsfx"}, "cmp1065xc000t04jrpq703iyy", "Lumphini Park", "Bangkok"],
  ["cmo52zw0l000clrrq4u0dn61z", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1067vv003004jruk0zitod", "Lunch at N Burger; Seoul Tower", "Seoul"],
  ["cmo533y79000305jvxvhqmhy3", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069po005104jrpteq48ko", "Meiji Jingu", "Tokyo"],
  ["cmp4kw6ox000h04jpe0wpfw39", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000h04kw0vvg5z2r", "Mercado de Artesanías de Teotihuacán", "Mexico City"],
  ["cmp4kw6ox000b04jphw97v0mr", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000b04kwt3cam5bj", "Mercado de Coyoacán", "Mexico City"],
  ["cmp4kw6ox000i04jp2e2kwl2y", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000i04kw26eoj6ex", "Mercado Medellín", "Mexico City"],
  ["cmp4kw6ox000l04jpv01ikm28", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000l04kwmpxjbv2l", "Mercado Roma", "Mexico City"],
  ["cmo530phz000ulrrqqe08gq2u", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp10665k001204jrenjriy0q", "Monkey Park Kyoto", "Kyoto"],
  ["cmo58onk3000304jsyf1q0rpw", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066wj001w04jriptmq76j", "Mu-Kii", "Dubai"],
  ["cmo5p0nqg000904la8vin22ax", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp1065ee000804jrelmts0fq", "Muay Thai Fights", "Bangkok"],
  ["cmp4kw6ox000a04jpllle8pfi", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000a04kwucyw2vwt", "Museo Frida Kahlo (Casa Azul)", "Mexico City"],
  ["cmp4kw6ox000604jp6ful69mf", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000604kwv6i3awdp", "Museo Nacional de Antropología", "Mexico City"],
  ["cmo4zyb9e000004l4nt41gttq", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1067hn002k04jrcwnbxdtw", "Myeongdong Night Market", "Seoul"],
  ["cmoxtztky000304l4bu5jd1ql", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp1068af003f04jrbwp8ln3o", "NaturePop", "Onna"],
  ["cmo530n80000slrrq8sedwbf9", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1069dg004n04jr0nz6xfxy", "Ninna-Ji", "Kyoto"],
  ["cmo530str000xlrrqno8u85mg", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1069br004l04jr98gs9jja", "Nishiki Market", "Kyoto"],
  ["cmp4kw6ox000404jpcxkywjh4", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000404kwgpx2d8xh", "Palacio de Bellas Artes", "Mexico City"],
  ["cmo58omut000f04l155sm2pwi", {"tripId": "cmnquuqzw000204lfn4dy2gsj"}, "cmp1066r2001q04jr1l27gf8g", "Palm Atlantis", "Dubai"],
  ["cmp4kw6ox000k04jpark1ws5k", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000k04kwa0s5w1uc", "Parque México", "Mexico City"],
  ["cmp4kw6ox000f04jplrcwlwbk", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000f04kwx56ufwel", "Pirámide de la Luna and Avenue of the Dead", "Mexico City"],
  ["cmp4kw6ox000e04jpxwyshw4x", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000e04kwomk7pk1y", "Pirámide del Sol, Teotihuacán", "Mexico City"],
  ["cmo536j0s000b05jv3m7zz6sn", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067ik002l04jr3x3fbe8n", "Pratu Tha Phae", "Chiang Mai"],
  ["cmp4kw6ox000804jpughmu64h", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000804kw4ws4ok7d", "Quintonil", "Mexico City"],
  ["cmoxtztau000304jv5o75n9e3", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp1068ew003k04jr73xsvdeo", "Resort Swimming", "Onna"],
  ["cmo533y4n000304jrlnf0dkjq", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069jm004u04jrlvadqnnk", "Rock Climbing", "Tokyo"],
  ["cmoxtztam000304jilazg52kz", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp1068go003m04jrbf846ctr", "Ryukyu Beach Club", "Onna"],
  ["cmo5azk1y000504l5ct6rh3g7", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp10654a000004jrnrkka322", "Sala Dan Walking Street", "Koh Lanta"],
  ["cmo5300os000elrrq05saik87", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp10683w003904jraq1rr3gc", "Sam Ryan's South Korea", "Busan"],
  ["cmo530ihe000nlrrqrhcnkobv", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp106989004h04jr9lf4gih2", "Samurai Museum Kyoto", "Kyoto"],
  ["cmo536iyt000a04l2kojmy9in", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067jf002m04jrvea3j79j", "San Pa Khoi Market", "Chiang Mai"],
  ["cmo536igt000704jm9hg3xsy0", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp10679s002b04jr8sw2rciq", "Sao Inthakhin", "Chiang Mai"],
  ["cmoxtztb6000304jrm501hvz5", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp1068d4003i04jrfpxh6yhp", "Serale Breakfast Buffet", "Onna"],
  ["cmo533xeh000l04l2bomdjkdb", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069m8004x04jrdm78svg0", "Shibuya Crossing", "Tokyo"],
  ["cmo533xkg000904jzsa6l8rk8", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1067pn002t04jrgm5ia2lt", "Shinjuku", "Tokyo"],
  ["cmo5p0onl000304l7qes8w53j", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp10672q002304jr2rsvam4j", "Siam Paragon", "Bangkok"],
  ["cmo59jd53000504l86d1pyr14", {"tripId": "cmmy95w8b000004l5l8rd4e01"}, "cmp10688l003d04jr4jywwfy3", "Singha Park", "Chiang Rai"],
  ["cmo52ztep000blrrqivcxuwgt", {"tripId": "cmmx6428k000004jlxgel7s86"}, "cmp1067nu002r04jrrrshq5yq", "Sky Cab", "Busan"],
  ["cmo533x4e000b04l2az8ksi6u", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069nx004z04jrw8wvrhzv", "SMOKEHOUSE (Jingumae)", "Tokyo"],
  ["cmo530hmu000mlrrqf97akrkw", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp106995004i04jr72wkxfy0", "Soba Noodles at Yoshimura", "Kyoto"],
  ["cmo530wye0010lrrqd4dtls3f", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1069aw004k04jrh7iy7swe", "Sumo Show", "Kyoto"],
  ["cmo530jdi000olrrqw819zz1z", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp10687p003c04jrfxn90tyl", "Sushi no Musashi", "Kyoto"],
  ["cmo533x6g000a04jrf71ndb05", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp106907004804jrjd4txy1k", "Sushi Saito (Vegetarian Omakase Counter)", "Tokyo"],
  ["cmoxtztaw000304jld0u16q5x", {"tripId": "cmmet611o0000yn8nz6ss7yg4"}, "cmp106815003604jr58ay82eo", "Taco Blue", "Naha"],
  ["cmo533xnb000h04jrqe2hn9ch", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069ot005004jrytxtk2re", "Takeshita Street", "Tokyo"],
  ["cmo533x4m000c04l2890dkt1a", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069qj005204jr2cy1hb5i", "Teamlabs Planets", "Tokyo"],
  ["cmp4kw6ow000204jptj8f8z87", {"tripId": "cmp4kyn21000004kwlahvdbz1"}, "cmp4kyn54000204kwnnm9026m", "Templo Mayor Museum", "Mexico City"],
  ["cmo533y57000304iinzbmp2be", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069f8004p04jrndq8uxgs", "Teppanyaki YAMAHIKO", "Tokyo"],
  ["cmo530vw8000zlrrqqzxv5np7", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1065kr000f04jrhukjgg2f", "Teramachi", "Kyoto"],
  ["cmo5pgn7s000d04l7flxzwgu9", {"tripId": "cmo2xj2du000004l8k08yyn0i"}, "cmp1067t7002x04jrc99n59al", "THANK ramen", "Hiratsuka"],
  ["cmo59jd9s000804l84h8m3voj", {"tripId": "cmmy95w8b000004l5l8rd4e01"}, "cmp1068k8003q04jr9j05nk89", "The Hill Tribes, A Coffee House", "Chiang Rai"],
  ["cmo530md9000rlrrq8fi3jhdu", {"tripId": "cmmyecm11000004jrdj3zwmi0"}, "cmp1069a0004j04jry11scocn", "The Philosopher's Path", "Kyoto"],
  ["cmo533y5l000304ib9mrtqtkk", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1069cl004m04jr8mhw7vs0", "Tokyo Dome City", "Tokyo"],
  ["cmo533y4c000304ic06xndbh7", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp106698001604jrkq51wpnz", "Toyosu Park", "Tokyo"],
  ["cmo533xaa000g04l2l4j0lrjh", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp10660w000x04jrq53jn5ac", "Toyosu Senkyaku Banrai", "Tokyo"],
  ["cmo5azk8s000804ikc1m2gav0", {"tripId": "cmnqut92m000104lffty6397h"}, "cmp106585000204jrlwhw9qp2", "Tung Yee Peng Mangrove Forest Tour", "Koh Lanta"],
  ["cmo536if3000904l8cbph74t5", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067db002f04jrq2njop4x", "Wan Phan Tao", "Chiang Mai"],
  ["cmo5p0onl000304jmc5vyi634", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp1068uw004204jry34r97kz", "Wat Arun", "Bangkok"],
  ["cmo536ige000704jr1863ecs0", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp10670z002104jrk4taiz1y", "Wat Chedi", "Chiang Mai"],
  ["cmo536in5000j04l8snqta37a", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067f0002h04jr45yehuyd", "Wat Inthakhi", "Chiang Mai"],
  ["cmo536j0f000b04l2c7c0ufms", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1065ml000h04jry6yc3vl2", "Wat Lam Chang", "Chiang Mai"],
  ["cmo5p0ojd000304jxi4kiahfq", {"tripId": "cmo0tcd05000004l1adf7tt8c"}, "cmp10664j001104jr8vanjj6v", "Wat Po", "Bangkok"],
  ["cmo536ihq000b04l8oivwpm2i", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067l5002o04jrxc5c0ijt", "Wat Pra Singh", "Chiang Mai"],
  ["cmo59jd4w000704kyrak57zwv", {"tripId": "cmmy95w8b000004l5l8rd4e01"}, "cmp106830003804jr1wb6urf2", "Wat Rong Khun", "Chiang Rai"],
  ["cmo533x7m000604jzzy2txra3", {"tripId": "cmmycshfj000004jpyadzdp8y"}, "cmp1066do001b04jr21ythnvb", "Yodobashi Akiba", "Tokyo"],
  ["cmo536ily000i04l8x3fk73th", {"tripId": "cmo0t52de000004jow1m57i3l"}, "cmp1067fx002i04jrkmj5glp2", "Zabb E Lee Cooking School", "Chiang Mai"],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Safety: verify all keep and dup IDs exist, are live, and belong to correct profile
const allIds = MERGE_OPS.flatMap(([keepId, , dupId]) => [keepId, dupId]);
const uniqueIds = [...new Set(allIds)];
const checkRes = await client.query(
  `SELECT id FROM "SavedItem"
   WHERE id = ANY($1::text[])
     AND "familyProfileId" = $2
     AND "deletedAt" IS NULL`,
  [uniqueIds, FAMILY_PROFILE_ID]
);
const liveIds = new Set(checkRes.rows.map(r => r.id));
const missingIds = uniqueIds.filter(id => !liveIds.has(id));
if (missingIds.length > 0) {
  console.warn(`NOTE: ${missingIds.length} IDs not live (may already be processed): ${missingIds.join(", ")}`);
}
console.log(`Safety check: ${liveIds.size}/${uniqueIds.length} IDs live on correct profile. Proceeding.\n`);

// Before count
const beforeRes = await client.query(
  `SELECT COUNT(*) FROM "SavedItem" WHERE "familyProfileId" = $1 AND "deletedAt" IS NULL`,
  [FAMILY_PROFILE_ID]
);
const countBefore = parseInt(beforeRes.rows[0].count);
console.log(`Live SavedItem count before: ${countBefore}`);

let mergedCount = 0;
let softDeletedCount = 0;

for (const [keepId, merges, dupId, title, city] of MERGE_OPS) {
  // Skip groups already processed in a prior run
  if (!liveIds.has(dupId)) {
    console.log(`SKIP (already done) [${city}] "${title}"`);
    continue;
  }
  if (!liveIds.has(keepId)) {
    console.warn(`WARN: keep ${keepId} not live for [${city}] "${title}" — skipping`);
    continue;
  }

  // shareToken is subject to a unique constraint: NULL it on the dup before copying to keep
  if (merges.shareToken) {
    await client.query(
      `UPDATE "SavedItem" SET "shareToken" = NULL WHERE id = $1 AND "familyProfileId" = $2 AND "deletedAt" IS NULL`,
      [dupId, FAMILY_PROFILE_ID]
    );
  }

  // Build SET clause for non-null-only merge (only set if keep row field is null)
  const setClauses = [];
  const params = [];
  let pIdx = 1;

  for (const [col, val] of Object.entries(merges)) {
    setClauses.push(`"${col}" = CASE WHEN "${col}" IS NULL THEN $${pIdx} ELSE "${col}" END`);
    params.push(val);
    pIdx++;
  }

  if (setClauses.length > 0) {
    params.push(keepId, FAMILY_PROFILE_ID);
    const updateRes = await client.query(
      `UPDATE "SavedItem" SET ${setClauses.join(", ")}
       WHERE id = $${pIdx} AND "familyProfileId" = $${pIdx + 1} AND "deletedAt" IS NULL`,
      params
    );
    if (updateRes.rowCount > 0) {
      mergedCount++;
      const fieldList = Object.entries(merges).map(([c, v]) => `${c}=${v}`).join(", ");
      console.log(`MERGE [${city}] "${title}": copied ${fieldList} → keep ${keepId}`);
    }
  }

  // Soft-delete the dup
  const delRes = await client.query(
    `UPDATE "SavedItem" SET "deletedAt" = now()
     WHERE id = $1 AND "familyProfileId" = $2 AND "deletedAt" IS NULL`,
    [dupId, FAMILY_PROFILE_ID]
  );
  if (delRes.rowCount > 0) {
    softDeletedCount++;
    console.log(`  SOFT-DELETE dup ${dupId}`);
  }
}

// After count
const afterRes = await client.query(
  `SELECT COUNT(*) FROM "SavedItem" WHERE "familyProfileId" = $1 AND "deletedAt" IS NULL`,
  [FAMILY_PROFILE_ID]
);
const countAfter = parseInt(afterRes.rows[0].count);

console.log(`\n=== SUMMARY ===`);
console.log(`Keep rows updated with merged associations: ${mergedCount}`);
console.log(`Dup rows soft-deleted: ${softDeletedCount}`);
console.log(`Live SavedItem count before: ${countBefore}`);
console.log(`Live SavedItem count after:  ${countAfter}`);
console.log(`Net reduction: ${countBefore - countAfter}`);
console.log(`CONFLICT groups: 0 (none — all groups were clean-merge)`);

await client.end();
console.log("DONE");
