-- Batch fill: question_order 3 & 4 for 18 films
-- Generated 2026-03-27

insert into public.question_pool_questions (
  movie_id,
  tmdb_movie_id,
  question_order,
  question_key,
  question_translations,
  options_translations,
  correct_option,
  explanation_translations,
  difficulty,
  source,
  metadata
) values

-- ========================================
-- 1. A Quiet Place: Day One (762441)
-- ========================================
(
  '77955378-a858-47d2-8599-5828bd103991', 762441, 3,
  'batch_fill:762441:3',
  '{"tr": "A Quiet Place: Day One filminde Sam''ın kedisinin adı nedir?", "en": "What is the name of Sam''s cat in A Quiet Place: Day One?"}'::jsonb,
  '{"tr": {"a": "Gandalf", "b": "Frodo", "c": "Bilbo", "d": "Samwise"}, "en": {"a": "Gandalf", "b": "Frodo", "c": "Bilbo", "d": "Samwise"}}'::jsonb,
  'b',
  '{"tr": "Sam''ın kedisinin adı Frodo''dur. Kedi, film boyunca Sam''ın en önemli yol arkadaşıdır.", "en": "Sam''s cat is named Frodo. The cat is Sam''s most important companion throughout the film."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '77955378-a858-47d2-8599-5828bd103991', 762441, 4,
  'batch_fill:762441:4',
  '{"tr": "Filmde Eric karakterini hangi oyuncu canlandırmıştır?", "en": "Which actor plays Eric in the film?"}'::jsonb,
  '{"tr": {"a": "Alex Wolff", "b": "Cillian Murphy", "c": "Joseph Quinn", "d": "John Krasinski"}, "en": {"a": "Alex Wolff", "b": "Cillian Murphy", "c": "Joseph Quinn", "d": "John Krasinski"}}'::jsonb,
  'c',
  '{"tr": "Eric karakterini Joseph Quinn canlandırmıştır. Quinn, İngiliz bir hukuk öğrencisi olan Eric rolüyle dikkat çekmiştir.", "en": "Eric is played by Joseph Quinn. Quinn portrays Eric, an English law student who encounters Sam in the chaos."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 2. After We Fell (744275)
-- ========================================
(
  'fff12321-45db-4fc1-844c-0fa5d03967b5', 744275, 3,
  'batch_fill:744275:3',
  '{"tr": "After We Fell filminde Tessa hangi şehre iş için taşınmayı planlar?", "en": "In After We Fell, which city does Tessa plan to move to for a job?"}'::jsonb,
  '{"tr": {"a": "New York", "b": "Los Angeles", "c": "Seattle", "d": "Chicago"}, "en": {"a": "New York", "b": "Los Angeles", "c": "Seattle", "d": "Chicago"}}'::jsonb,
  'c',
  '{"tr": "Tessa, bir yayıncılık işi için Seattle''a taşınmayı planlar ve bu durum Hardin ile arasında gerilime neden olur.", "en": "Tessa plans to move to Seattle for a publishing job, which creates tension between her and Hardin."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'fff12321-45db-4fc1-844c-0fa5d03967b5', 744275, 4,
  'batch_fill:744275:4',
  '{"tr": "After We Fell filminde Tessa''nın annesini hangi oyuncu canlandırır?", "en": "Which actress plays Tessa''s mother in After We Fell?"}'::jsonb,
  '{"tr": {"a": "Selma Blair", "b": "Mira Sorvino", "c": "Louise Lombard", "d": "Frances Turner"}, "en": {"a": "Selma Blair", "b": "Mira Sorvino", "c": "Louise Lombard", "d": "Frances Turner"}}'::jsonb,
  'b',
  '{"tr": "Tessa''nın annesi Carol Young karakterini Mira Sorvino canlandırmıştır.", "en": "Tessa''s mother Carol Young is played by Mira Sorvino."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 3. Donnie Darko (141)
-- ========================================
(
  '0fd4e1bb-fe33-41f2-9ee1-9716f9b28d2e', 141, 3,
  'batch_fill:141:3',
  '{"tr": "Donnie Darko filminde Frank karakteri hangi hayvan kıyafeti giyer?", "en": "What animal costume does the character Frank wear in Donnie Darko?"}'::jsonb,
  '{"tr": {"a": "Ayı", "b": "Kurt", "c": "Tavşan", "d": "Geyik"}, "en": {"a": "Bear", "b": "Wolf", "c": "Rabbit", "d": "Deer"}}'::jsonb,
  'c',
  '{"tr": "Frank, ürkütücü bir tavşan kostümü giyer ve Donnie''ye dünyanın 28 gün içinde sona ereceğini söyler.", "en": "Frank wears a creepy rabbit costume and tells Donnie that the world will end in 28 days."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '0fd4e1bb-fe33-41f2-9ee1-9716f9b28d2e', 141, 4,
  'batch_fill:141:4',
  '{"tr": "Donnie Darko, hangi ünlü komedyenin ilk sinema filmi deneyimi olmuştur?", "en": "Donnie Darko marked the film debut of which famous comedian?"}'::jsonb,
  '{"tr": {"a": "Jonah Hill", "b": "Seth Rogen", "c": "James Franco", "d": "Michael Cera"}, "en": {"a": "Jonah Hill", "b": "Seth Rogen", "c": "James Franco", "d": "Michael Cera"}}'::jsonb,
  'b',
  '{"tr": "Donnie Darko, Seth Rogen''ın ilk sinema filmi olma özelliğini taşır.", "en": "Donnie Darko marks Seth Rogen''s film debut."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 4. Flipped (43949)
-- ========================================
(
  '444a758b-6f1f-4b23-8914-34cd9909bbf9', 43949, 3,
  'batch_fill:43949:3',
  '{"tr": "Flipped filminin yönetmeni kimdir?", "en": "Who directed the movie Flipped?"}'::jsonb,
  '{"tr": {"a": "Steven Spielberg", "b": "Rob Reiner", "c": "Nora Ephron", "d": "Cameron Crowe"}, "en": {"a": "Steven Spielberg", "b": "Rob Reiner", "c": "Nora Ephron", "d": "Cameron Crowe"}}'::jsonb,
  'b',
  '{"tr": "Flipped, Rob Reiner tarafından yönetilmiş ve Wendelin Van Draanen''ın aynı adlı romanından uyarlanmıştır.", "en": "Flipped was directed by Rob Reiner and is based on Wendelin Van Draanen''s novel of the same name."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '444a758b-6f1f-4b23-8914-34cd9909bbf9', 43949, 4,
  'batch_fill:43949:4',
  '{"tr": "Flipped filminde Juli karakterini hangi oyuncu canlandırır?", "en": "Which actress plays Juli in Flipped?"}'::jsonb,
  '{"tr": {"a": "Madeline Carroll", "b": "Chloë Grace Moretz", "c": "Emma Roberts", "d": "Abigail Breslin"}, "en": {"a": "Madeline Carroll", "b": "Chloë Grace Moretz", "c": "Emma Roberts", "d": "Abigail Breslin"}}'::jsonb,
  'a',
  '{"tr": "Juli karakterini Madeline Carroll canlandırır. Bryce rolünde ise Callan McAuliffe yer alır.", "en": "Juli is played by Madeline Carroll. Callan McAuliffe plays Bryce."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 5. Frankenstein (1062722)
-- ========================================
(
  'bd632543-2c51-4965-96ac-844e3530a421', 1062722, 3,
  'batch_fill:1062722:3',
  '{"tr": "Guillermo del Toro''nun Frankenstein filminde Yaratık karakterini hangi oyuncu canlandırır?", "en": "Which actor plays the Creature in Guillermo del Toro''s Frankenstein?"}'::jsonb,
  '{"tr": {"a": "Oscar Isaac", "b": "Christoph Waltz", "c": "Andrew Garfield", "d": "Jacob Elordi"}, "en": {"a": "Oscar Isaac", "b": "Christoph Waltz", "c": "Andrew Garfield", "d": "Jacob Elordi"}}'::jsonb,
  'd',
  '{"tr": "Yaratık karakterini Jacob Elordi canlandırır. Andrew Garfield başlangıçta rol için seçilmişti ancak takvim çakışması nedeniyle projeden ayrılmıştır.", "en": "The Creature is played by Jacob Elordi. Andrew Garfield was originally cast but left due to scheduling conflicts from the SAG-AFTRA strikes."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'bd632543-2c51-4965-96ac-844e3530a421', 1062722, 4,
  'batch_fill:1062722:4',
  '{"tr": "Del Toro''nun Frankenstein filminde Victor, cesetleri nereden toplar?", "en": "In del Toro''s Frankenstein, where does Victor salvage corpses from?"}'::jsonb,
  '{"tr": {"a": "Londra hastaneleri", "b": "Kırım Savaşı savaş alanı", "c": "Paris mezarlıkları", "d": "Napolyon Savaşları alanları"}, "en": {"a": "London hospitals", "b": "A Crimean War battlefield", "c": "Paris cemeteries", "d": "Napoleonic War fields"}}'::jsonb,
  'b',
  '{"tr": "Victor Frankenstein, Kırım Savaşı savaş alanından cesetleri toplar.", "en": "Victor Frankenstein salvages corpses from a Crimean War battlefield."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 6. Marty Supreme (1317288)
-- ========================================
(
  'e76453d4-061f-4195-9972-a05126f5b71b', 1317288, 3,
  'batch_fill:1317288:3',
  '{"tr": "Marty Supreme filminin yönetmeni kimdir?", "en": "Who directed Marty Supreme?"}'::jsonb,
  '{"tr": {"a": "Benny Safdie", "b": "Damien Chazelle", "c": "Josh Safdie", "d": "Paul Thomas Anderson"}, "en": {"a": "Benny Safdie", "b": "Damien Chazelle", "c": "Josh Safdie", "d": "Paul Thomas Anderson"}}'::jsonb,
  'c',
  '{"tr": "Marty Supreme, Josh Safdie tarafından yönetilmiştir. Safdie, filmi Ronald Bronstein ile birlikte yazmıştır.", "en": "Marty Supreme was directed by Josh Safdie, who co-wrote it with Ronald Bronstein."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'e76453d4-061f-4195-9972-a05126f5b71b', 1317288, 4,
  'batch_fill:1317288:4',
  '{"tr": "Marty Supreme filmi hangi gerçek sporcudan esinlenmiştir?", "en": "Which real-life athlete inspired Marty Supreme?"}'::jsonb,
  '{"tr": {"a": "Marty Reisman", "b": "Jan-Ove Waldner", "c": "Ichiro Ogimura", "d": "Viktor Barna"}, "en": {"a": "Marty Reisman", "b": "Jan-Ove Waldner", "c": "Ichiro Ogimura", "d": "Viktor Barna"}}'::jsonb,
  'a',
  '{"tr": "Film, Amerikalı masa tenisi şampiyonu Marty Reisman''dan esinlenmiştir. Reisman, 1950''lerde masa tenisinin efsanevi isimlerinden biriydi.", "en": "The film is loosely inspired by American table tennis champion Marty Reisman, a legendary figure in 1950s ping pong."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 7. Mickey 17 (696506)
-- ========================================
(
  'cc81c570-9bca-4933-be0e-be15d5680db6', 696506, 3,
  'batch_fill:696506:3',
  '{"tr": "Mickey 17 filminde kolonize edilmeye çalışılan gezegenin adı nedir?", "en": "What is the name of the planet being colonized in Mickey 17?"}'::jsonb,
  '{"tr": {"a": "Asgard", "b": "Helheim", "c": "Niflheim", "d": "Midgard"}, "en": {"a": "Asgard", "b": "Helheim", "c": "Niflheim", "d": "Midgard"}}'::jsonb,
  'c',
  '{"tr": "Kolonize edilmeye çalışılan buz gezegeni Niflheim''dır. İsim, İskandinav mitolojisindeki buz diyarından gelir.", "en": "The ice planet being colonized is called Niflheim, named after the realm of ice in Norse mythology."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'cc81c570-9bca-4933-be0e-be15d5680db6', 696506, 4,
  'batch_fill:696506:4',
  '{"tr": "Mickey 17 filminde Kenneth Marshall karakterini hangi oyuncu canlandırır?", "en": "Which actor plays Kenneth Marshall in Mickey 17?"}'::jsonb,
  '{"tr": {"a": "Steven Yeun", "b": "Toni Collette", "c": "Robert Pattinson", "d": "Mark Ruffalo"}, "en": {"a": "Steven Yeun", "b": "Toni Collette", "c": "Robert Pattinson", "d": "Mark Ruffalo"}}'::jsonb,
  'd',
  '{"tr": "Kenneth Marshall karakterini Mark Ruffalo canlandırır. Marshall, Niflheim için karanlık planları olan megaloman bir politikacıdır.", "en": "Kenneth Marshall is played by Mark Ruffalo. Marshall is an egomaniacal failed politician with sinister designs for Niflheim."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 8. Mystic River (322)
-- ========================================
(
  'd1205591-7b90-4b0f-b88b-7b74546c41a0', 322, 3,
  'batch_fill:322:3',
  '{"tr": "Mystic River filminde Dave Boyle karakterini hangi oyuncu canlandırır?", "en": "Which actor plays Dave Boyle in Mystic River?"}'::jsonb,
  '{"tr": {"a": "Kevin Bacon", "b": "Sean Penn", "c": "Tim Robbins", "d": "Laurence Fishburne"}, "en": {"a": "Kevin Bacon", "b": "Sean Penn", "c": "Tim Robbins", "d": "Laurence Fishburne"}}'::jsonb,
  'c',
  '{"tr": "Dave Boyle karakterini Tim Robbins canlandırır. Robbins bu rolüyle En İyi Yardımcı Erkek Oyuncu Oscar''ını kazanmıştır.", "en": "Dave Boyle is played by Tim Robbins, who won the Academy Award for Best Supporting Actor for this role."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'd1205591-7b90-4b0f-b88b-7b74546c41a0', 322, 4,
  'batch_fill:322:4',
  '{"tr": "Mystic River hangi yazarın romanından uyarlanmıştır?", "en": "Mystic River is based on a novel by which author?"}'::jsonb,
  '{"tr": {"a": "Stephen King", "b": "Michael Connelly", "c": "James Ellroy", "d": "Dennis Lehane"}, "en": {"a": "Stephen King", "b": "Michael Connelly", "c": "James Ellroy", "d": "Dennis Lehane"}}'::jsonb,
  'd',
  '{"tr": "Film, Dennis Lehane''ın 2001 yılında yayımlanan aynı adlı romanından uyarlanmıştır. Senaryo Brian Helgeland tarafından yazılmıştır.", "en": "The film is based on Dennis Lehane''s 2001 novel of the same name. The screenplay was written by Brian Helgeland."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 9. Novocaine (1195506)
-- ========================================
(
  'c26167e6-d7b2-4680-818d-e037ee65727b', 1195506, 3,
  'batch_fill:1195506:3',
  '{"tr": "Novocaine filminde Nathan Caine''in özel durumu nedir?", "en": "What is Nathan Caine''s special condition in Novocaine?"}'::jsonb,
  '{"tr": {"a": "Süper güç", "b": "Ağrı hissedememe", "c": "Hafıza kaybı", "d": "Renk körlüğü"}, "en": {"a": "Super strength", "b": "Inability to feel pain", "c": "Memory loss", "d": "Color blindness"}}'::jsonb,
  'b',
  '{"tr": "Nathan Caine, doğuştan ağrı duyarsızlığı (CIPA) adlı nadir bir rahatsızlığa sahiptir ve hiçbir acı hissedemez.", "en": "Nathan Caine has congenital insensitivity to pain with anhidrosis (CIPA), a rare condition that prevents him from feeling any pain."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'c26167e6-d7b2-4680-818d-e037ee65727b', 1195506, 4,
  'batch_fill:1195506:4',
  '{"tr": "Novocaine filminde Sherry karakterini hangi oyuncu canlandırır?", "en": "Which actress plays Sherry in Novocaine?"}'::jsonb,
  '{"tr": {"a": "Betty Gabriel", "b": "Amber Midthunder", "c": "Jenna Ortega", "d": "Sydney Sweeney"}, "en": {"a": "Betty Gabriel", "b": "Amber Midthunder", "c": "Jenna Ortega", "d": "Sydney Sweeney"}}'::jsonb,
  'b',
  '{"tr": "Sherry Margrave karakterini Amber Midthunder canlandırır. Sherry, Nathan''ın iş arkadaşı ve aşkıdır.", "en": "Sherry Margrave is played by Amber Midthunder. Sherry is Nathan''s co-worker and love interest."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 10. Scream 2 (4233)
-- ========================================
(
  'aa70dd89-fe3f-4a7a-b147-a85f4f3d5d96', 4233, 3,
  'batch_fill:4233:3',
  '{"tr": "Scream 2''de Woodsboro olaylarından esinlenen korku filminin adı nedir?", "en": "What is the name of the horror movie inspired by the Woodsboro events in Scream 2?"}'::jsonb,
  '{"tr": {"a": "Slash", "b": "Stab", "c": "Scream", "d": "Killer"}, "en": {"a": "Slash", "b": "Stab", "c": "Scream", "d": "Killer"}}'::jsonb,
  'b',
  '{"tr": "Film içindeki film \"Stab\" olarak adlandırılır ve Woodsboro''daki gerçek olaylardan esinlenmiştir.", "en": "The movie-within-a-movie is called \"Stab\" and is inspired by the real events in Woodsboro."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'aa70dd89-fe3f-4a7a-b147-a85f4f3d5d96', 4233, 4,
  'batch_fill:4233:4',
  '{"tr": "Scream 2''de katillerden biri olan Mrs. Loomis, hangi oyuncu tarafından canlandırılır?", "en": "Which actress plays Mrs. Loomis, one of the killers in Scream 2?"}'::jsonb,
  '{"tr": {"a": "Neve Campbell", "b": "Courteney Cox", "c": "Sarah Michelle Gellar", "d": "Laurie Metcalf"}, "en": {"a": "Neve Campbell", "b": "Courteney Cox", "c": "Sarah Michelle Gellar", "d": "Laurie Metcalf"}}'::jsonb,
  'd',
  '{"tr": "Mrs. Loomis (Debbie Salt takma adıyla) karakterini Laurie Metcalf canlandırır. O, ilk filmdeki katil Billy Loomis''in annesidir.", "en": "Mrs. Loomis (under the alias Debbie Salt) is played by Laurie Metcalf. She is the mother of first film''s killer Billy Loomis."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 11. Sisu (840326)
-- ========================================
(
  '7dd92adb-4d02-4316-9551-9e17ae3c8542', 840326, 3,
  'batch_fill:840326:3',
  '{"tr": "Sisu filminde Aatami Korpi, Kızıl Ordu tarafından hangi lakabla anılır?", "en": "What nickname does the Red Army give Aatami Korpi in Sisu?"}'::jsonb,
  '{"tr": {"a": "Ölüm Meleği", "b": "Hayalet Asker", "c": "Koschei (Ölümsüz)", "d": "Kuzey Kurdu"}, "en": {"a": "Angel of Death", "b": "Ghost Soldier", "c": "Koschei (The Immortal)", "d": "Northern Wolf"}}'::jsonb,
  'c',
  '{"tr": "Stalin''ın Kızıl Ordusu Aatami''ye \"Koschei\" yani \"Ölümsüz\" lakabını takmıştır, çünkü onu öldürmek imkansız görünmektedir.", "en": "Stalin''s Red Army nicknamed Aatami \"Koschei\", meaning \"The Immortal\", because he seemed impossible to kill."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),
(
  '7dd92adb-4d02-4316-9551-9e17ae3c8542', 840326, 4,
  'batch_fill:840326:4',
  '{"tr": "Sisu filmi hangi savaş döneminde geçer?", "en": "During which war is Sisu set?"}'::jsonb,
  '{"tr": {"a": "Kış Savaşı", "b": "Devam Savaşı", "c": "Laponya Savaşı", "d": "Birinci Dünya Savaşı"}, "en": {"a": "The Winter War", "b": "The Continuation War", "c": "The Lapland War", "d": "World War I"}}'::jsonb,
  'c',
  '{"tr": "Film, 1944 yılında Finlandiya ile Nazi Almanyası arasındaki Laponya Savaşı döneminde geçer.", "en": "The film is set during the Lapland War between Finland and Nazi Germany in 1944."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 12. The Faculty (9276)
-- ========================================
(
  '13394ebb-c5bf-4e55-86bb-259c129109c5', 9276, 3,
  'batch_fill:9276:3',
  '{"tr": "The Faculty filminde uyuşturucu satıcısı Zeke karakterini hangi oyuncu canlandırır?", "en": "Which actor plays Zeke, the drug dealer, in The Faculty?"}'::jsonb,
  '{"tr": {"a": "Elijah Wood", "b": "Shawn Hatosy", "c": "Usher Raymond", "d": "Josh Hartnett"}, "en": {"a": "Elijah Wood", "b": "Shawn Hatosy", "c": "Usher Raymond", "d": "Josh Hartnett"}}'::jsonb,
  'd',
  '{"tr": "Zeke karakterini Josh Hartnett canlandırır. Zeke, okulda uyuşturucu satan ancak uzaylı istilasına karşı savaşan öğrencilerden biridir.", "en": "Zeke is played by Josh Hartnett. Zeke is a drug dealer at school who becomes one of the students fighting the alien invasion."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '13394ebb-c5bf-4e55-86bb-259c129109c5', 9276, 4,
  'batch_fill:9276:4',
  '{"tr": "The Faculty filminin yönetmeni kimdir?", "en": "Who directed The Faculty?"}'::jsonb,
  '{"tr": {"a": "Wes Craven", "b": "Kevin Williamson", "c": "Robert Rodriguez", "d": "John Carpenter"}, "en": {"a": "Wes Craven", "b": "Kevin Williamson", "c": "Robert Rodriguez", "d": "John Carpenter"}}'::jsonb,
  'c',
  '{"tr": "The Faculty, Robert Rodriguez tarafından yönetilmiştir. Senaryoyu ise Scream serisinin yazarı Kevin Williamson kaleme almıştır.", "en": "The Faculty was directed by Robert Rodriguez. The screenplay was written by Kevin Williamson, the writer of the Scream franchise."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 13. The Fifth Element (18)
-- ========================================
(
  '42080ed9-aeee-4ea2-875a-134dda4ea842', 18, 3,
  'batch_fill:18:3',
  '{"tr": "Beşinci Element filminde Korben Dallas''ın mesleği nedir?", "en": "What is Korben Dallas''s profession in The Fifth Element?"}'::jsonb,
  '{"tr": {"a": "Polis", "b": "Taksi şoförü", "c": "Pilot", "d": "Asker"}, "en": {"a": "Police officer", "b": "Taxi driver", "c": "Pilot", "d": "Soldier"}}'::jsonb,
  'b',
  '{"tr": "Korben Dallas, eski bir özel kuvvetler subayı olup şu anda taksi şoförü olarak çalışmaktadır.", "en": "Korben Dallas is a former special forces major who now works as a taxi driver."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '42080ed9-aeee-4ea2-875a-134dda4ea842', 18, 4,
  'batch_fill:18:4',
  '{"tr": "Beşinci Element filminde Leeloo''nun konuştuğu ''İlahi Dil''i kim icat etmiştir?", "en": "Who invented the ''Divine Language'' spoken by Leeloo in The Fifth Element?"}'::jsonb,
  '{"tr": {"a": "Milla Jovovich", "b": "Bir dilbilimci ekibi", "c": "Luc Besson", "d": "Bruce Willis"}, "en": {"a": "Milla Jovovich", "b": "A team of linguists", "c": "Luc Besson", "d": "Bruce Willis"}}'::jsonb,
  'c',
  '{"tr": "İlahi Dil, yönetmen Luc Besson tarafından icat edilmiş ve Milla Jovovich ile birlikte geliştirilmiştir. İkili çekimler sırasında bu dilde konuşabilir hale gelmiştir.", "en": "The Divine Language was invented by director Luc Besson and further developed with Milla Jovovich. By the end of filming, they could hold full conversations in it."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 14. The Giver (227156)
-- ========================================
(
  'ba360dac-313a-4e62-a7e6-6357d591e480', 227156, 3,
  'batch_fill:227156:3',
  '{"tr": "The Giver filminde topluluktan ayrılanlar için kullanılan örtmece nedir?", "en": "What is the euphemism used for those who leave the community in The Giver?"}'::jsonb,
  '{"tr": {"a": "Özgürlüğe Yolculuk", "b": "Başka Yere Salıverme", "c": "Yeni Başlangıç", "d": "Büyük Geçiş"}, "en": {"a": "Journey to Freedom", "b": "Released to Elsewhere", "c": "New Beginning", "d": "The Great Passage"}}'::jsonb,
  'b',
  '{"tr": "Toplulukta ''Başka Yere Salıverme'' ifadesi kullanılır, ancak bunun aslında ötenazi anlamına geldiği ortaya çıkar.", "en": "The community uses the term ''Released to Elsewhere'', which Jonas discovers is actually a euphemism for euthanasia."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  'ba360dac-313a-4e62-a7e6-6357d591e480', 227156, 4,
  'batch_fill:227156:4',
  '{"tr": "The Giver filminde Başkadın karakterini hangi oyuncu canlandırır?", "en": "Which actress plays the Chief Elder in The Giver?"}'::jsonb,
  '{"tr": {"a": "Katie Holmes", "b": "Meryl Streep", "c": "Jodie Foster", "d": "Cate Blanchett"}, "en": {"a": "Katie Holmes", "b": "Meryl Streep", "c": "Jodie Foster", "d": "Cate Blanchett"}}'::jsonb,
  'b',
  '{"tr": "Başkadın karakterini Meryl Streep canlandırır. Streep, topluluk üzerinde kontrol sağlayan otoriter bir lider rolündedir.", "en": "The Chief Elder is played by Meryl Streep. Streep portrays the authoritarian leader who maintains control over the community."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 15. The Hunt (103663)
-- ========================================
(
  '5629bda3-2058-4e3c-a39c-8a9b518a5445', 103663, 3,
  'batch_fill:103663:3',
  '{"tr": "The Hunt filminde Lucas karakterini canlandıran Mads Mikkelsen hangi ödülü kazanmıştır?", "en": "What award did Mads Mikkelsen win for playing Lucas in The Hunt?"}'::jsonb,
  '{"tr": {"a": "Altın Küre - En İyi Aktör", "b": "BAFTA - En İyi Aktör", "c": "Cannes - En İyi Erkek Oyuncu", "d": "Oscar - En İyi Aktör"}, "en": {"a": "Golden Globe - Best Actor", "b": "BAFTA - Best Actor", "c": "Cannes - Best Actor", "d": "Oscar - Best Actor"}}'::jsonb,
  'c',
  '{"tr": "Mads Mikkelsen, bu roldeki performansıyla 65. Cannes Film Festivali''nde En İyi Erkek Oyuncu ödülünü kazanmıştır.", "en": "Mads Mikkelsen won the Best Actor Award at the 65th Cannes Film Festival for his performance in this role."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '5629bda3-2058-4e3c-a39c-8a9b518a5445', 103663, 4,
  'batch_fill:103663:4',
  '{"tr": "The Hunt filminin yönetmeni kimdir?", "en": "Who directed The Hunt?"}'::jsonb,
  '{"tr": {"a": "Lars von Trier", "b": "Nicolas Winding Refn", "c": "Susanne Bier", "d": "Thomas Vinterberg"}, "en": {"a": "Lars von Trier", "b": "Nicolas Winding Refn", "c": "Susanne Bier", "d": "Thomas Vinterberg"}}'::jsonb,
  'd',
  '{"tr": "Film, Thomas Vinterberg tarafından yönetilmiştir. Vinterberg, Dogme 95 akımının kurucularından biridir.", "en": "The film was directed by Thomas Vinterberg, one of the founders of the Dogme 95 movement."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 16. The Quick and the Dead (12106)
-- ========================================
(
  '2d2b82d5-cbfb-410d-b652-0e84a607b70e', 12106, 3,
  'batch_fill:12106:3',
  '{"tr": "The Quick and the Dead filminde kasabanın adı nedir?", "en": "What is the name of the town in The Quick and the Dead?"}'::jsonb,
  '{"tr": {"a": "Tombstone", "b": "Redemption", "c": "Deadwood", "d": "Salvation"}, "en": {"a": "Tombstone", "b": "Redemption", "c": "Deadwood", "d": "Salvation"}}'::jsonb,
  'b',
  '{"tr": "Kasabanın adı Redemption''dır ve John Herod tarafından demir yumrukla yönetilmektedir.", "en": "The town is called Redemption and is ruled with an iron fist by John Herod."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '2d2b82d5-cbfb-410d-b652-0e84a607b70e', 12106, 4,
  'batch_fill:12106:4',
  '{"tr": "The Quick and the Dead filminde genç silahşör ''The Kid'' karakterini hangi oyuncu canlandırır?", "en": "Which actor plays the young gunslinger ''The Kid'' in The Quick and the Dead?"}'::jsonb,
  '{"tr": {"a": "Russell Crowe", "b": "Brad Pitt", "c": "Leonardo DiCaprio", "d": "Keanu Reeves"}, "en": {"a": "Russell Crowe", "b": "Brad Pitt", "c": "Leonardo DiCaprio", "d": "Keanu Reeves"}}'::jsonb,
  'c',
  '{"tr": "''The Kid'' karakterini genç Leonardo DiCaprio canlandırır. Film, DiCaprio''nun kariyerindeki erken dönem rollerinden biridir.", "en": "''The Kid'' is played by a young Leonardo DiCaprio, in one of his early career roles."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 17. Weapons (1078605)
-- ========================================
(
  '6edc5f5e-fd2d-476a-8d5b-b2c3597b4940', 1078605, 3,
  'batch_fill:1078605:3',
  '{"tr": "Weapons filminin yönetmeni kimdir?", "en": "Who directed the movie Weapons?"}'::jsonb,
  '{"tr": {"a": "Jordan Peele", "b": "Ari Aster", "c": "Zach Cregger", "d": "Mike Flanagan"}, "en": {"a": "Jordan Peele", "b": "Ari Aster", "c": "Zach Cregger", "d": "Mike Flanagan"}}'::jsonb,
  'c',
  '{"tr": "Weapons, Zach Cregger tarafından yazılmış ve yönetilmiştir.", "en": "Weapons was written and directed by Zach Cregger."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '6edc5f5e-fd2d-476a-8d5b-b2c3597b4940', 1078605, 4,
  'batch_fill:1078605:4',
  '{"tr": "Weapons filminde kaç çocuk aynı gece gizemli bir şekilde evlerinden kaçar?", "en": "How many children mysteriously run away from their homes on the same night in Weapons?"}'::jsonb,
  '{"tr": {"a": "Yedi", "b": "On iki", "c": "On yedi", "d": "Yirmi bir"}, "en": {"a": "Seven", "b": "Twelve", "c": "Seventeen", "d": "Twenty-one"}}'::jsonb,
  'c',
  '{"tr": "Aynı sınıftan on yedi çocuk, aynı gece saat 2:17''de gizemli bir şekilde evlerinden kaçar.", "en": "Seventeen children from the same classroom mysteriously run away from their homes at 2:17 AM on the same night."}'::jsonb,
  'hard', 'batch_generate', '{}'::jsonb
),

-- ========================================
-- 18. Wolfs (877817)
-- ========================================
(
  '840a8dae-4afc-4a7d-8ac9-acd00cb6bf2f', 877817, 3,
  'batch_fill:877817:3',
  '{"tr": "Wolfs filminin yönetmeni kimdir?", "en": "Who directed the movie Wolfs?"}'::jsonb,
  '{"tr": {"a": "Steven Soderbergh", "b": "Jon Watts", "c": "Guy Ritchie", "d": "David Leitch"}, "en": {"a": "Steven Soderbergh", "b": "Jon Watts", "c": "Guy Ritchie", "d": "David Leitch"}}'::jsonb,
  'b',
  '{"tr": "Wolfs, Jon Watts tarafından yazılmış ve yönetilmiştir. Watts, Spider-Man: Homecoming üçlemesiyle de tanınır.", "en": "Wolfs was written and directed by Jon Watts, also known for the Spider-Man: Homecoming trilogy."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
),
(
  '840a8dae-4afc-4a7d-8ac9-acd00cb6bf2f', 877817, 4,
  'batch_fill:877817:4',
  '{"tr": "Wolfs filminde olayları başlatan kazayı yaşayan politikacıyı hangi oyuncu canlandırır?", "en": "Which actress plays the politician whose accident sets the events in motion in Wolfs?"}'::jsonb,
  '{"tr": {"a": "Poorna Jagannathan", "b": "Sandra Bullock", "c": "Amy Ryan", "d": "Julia Roberts"}, "en": {"a": "Poorna Jagannathan", "b": "Sandra Bullock", "c": "Amy Ryan", "d": "Julia Roberts"}}'::jsonb,
  'c',
  '{"tr": "Politikacı karakterini Amy Ryan canlandırır. Otel odasında yaşanan kaza, iki profesyonel temizlikçinin bir araya gelmesine neden olur.", "en": "The politician is played by Amy Ryan. Her hotel room accident brings the two professional fixers together."}'::jsonb,
  'medium', 'batch_generate', '{}'::jsonb
)

on conflict (movie_id, question_order) do nothing;
