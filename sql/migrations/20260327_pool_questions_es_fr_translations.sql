-- Add Spanish (es) and French (fr) translations to batch_fill Q3/Q4 questions
-- Generated 2026-03-27

-- ========================================
-- 1. A Quiet Place: Day One (762441)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cómo se llama el gato de Sam en A Quiet Place: Day One?", "fr": "Comment s''appelle le chat de Sam dans A Quiet Place: Day One ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Gandalf", "b": "Frodo", "c": "Bilbo", "d": "Samwise"}, "fr": {"a": "Gandalf", "b": "Frodo", "c": "Bilbo", "d": "Samwise"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "El gato de Sam se llama Frodo. El gato es el compañero más importante de Sam a lo largo de la película.", "fr": "Le chat de Sam s''appelle Frodo. Le chat est le compagnon le plus important de Sam tout au long du film."}'::jsonb
WHERE question_key = 'batch_fill:762441:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta a Eric en la película?", "fr": "Quel acteur joue Eric dans le film ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Alex Wolff", "b": "Cillian Murphy", "c": "Joseph Quinn", "d": "John Krasinski"}, "fr": {"a": "Alex Wolff", "b": "Cillian Murphy", "c": "Joseph Quinn", "d": "John Krasinski"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Eric es interpretado por Joseph Quinn. Quinn interpreta a Eric, un estudiante de derecho inglés que se encuentra con Sam en el caos.", "fr": "Eric est interprété par Joseph Quinn. Quinn incarne Eric, un étudiant en droit anglais qui rencontre Sam dans le chaos."}'::jsonb
WHERE question_key = 'batch_fill:762441:4';

-- ========================================
-- 2. After We Fell (744275)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "En After We Fell, ¿a qué ciudad planea mudarse Tessa por trabajo?", "fr": "Dans After We Fell, dans quelle ville Tessa prévoit-elle de déménager pour un emploi ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "New York", "b": "Los Angeles", "c": "Seattle", "d": "Chicago"}, "fr": {"a": "New York", "b": "Los Angeles", "c": "Seattle", "d": "Chicago"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Tessa planea mudarse a Seattle por un trabajo en una editorial, lo que genera tensión entre ella y Hardin.", "fr": "Tessa prévoit de déménager à Seattle pour un emploi dans l''édition, ce qui crée des tensions entre elle et Hardin."}'::jsonb
WHERE question_key = 'batch_fill:744275:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a la madre de Tessa en After We Fell?", "fr": "Quelle actrice joue la mère de Tessa dans After We Fell ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Selma Blair", "b": "Mira Sorvino", "c": "Louise Lombard", "d": "Frances Turner"}, "fr": {"a": "Selma Blair", "b": "Mira Sorvino", "c": "Louise Lombard", "d": "Frances Turner"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La madre de Tessa, Carol Young, es interpretada por Mira Sorvino.", "fr": "La mère de Tessa, Carol Young, est interprétée par Mira Sorvino."}'::jsonb
WHERE question_key = 'batch_fill:744275:4';

-- ========================================
-- 3. Donnie Darko (141)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué disfraz de animal lleva el personaje Frank en Donnie Darko?", "fr": "Quel déguisement d''animal porte le personnage Frank dans Donnie Darko ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Oso", "b": "Lobo", "c": "Conejo", "d": "Ciervo"}, "fr": {"a": "Ours", "b": "Loup", "c": "Lapin", "d": "Cerf"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Frank lleva un espeluznante disfraz de conejo y le dice a Donnie que el mundo terminará en 28 días.", "fr": "Frank porte un costume de lapin effrayant et dit à Donnie que le monde finira dans 28 jours."}'::jsonb
WHERE question_key = 'batch_fill:141:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Para qué famoso comediante fue Donnie Darko su debut en el cine?", "fr": "Donnie Darko a marqué les débuts au cinéma de quel célèbre humoriste ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Jonah Hill", "b": "Seth Rogen", "c": "James Franco", "d": "Michael Cera"}, "fr": {"a": "Jonah Hill", "b": "Seth Rogen", "c": "James Franco", "d": "Michael Cera"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Donnie Darko fue el debut cinematográfico de Seth Rogen.", "fr": "Donnie Darko marque les débuts au cinéma de Seth Rogen."}'::jsonb
WHERE question_key = 'batch_fill:141:4';

-- ========================================
-- 4. Flipped (43949)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió la película Flipped?", "fr": "Qui a réalisé le film Flipped ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Steven Spielberg", "b": "Rob Reiner", "c": "Nora Ephron", "d": "Cameron Crowe"}, "fr": {"a": "Steven Spielberg", "b": "Rob Reiner", "c": "Nora Ephron", "d": "Cameron Crowe"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Flipped fue dirigida por Rob Reiner y está basada en la novela homónima de Wendelin Van Draanen.", "fr": "Flipped a été réalisé par Rob Reiner et est adapté du roman éponyme de Wendelin Van Draanen."}'::jsonb
WHERE question_key = 'batch_fill:43949:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a Juli en Flipped?", "fr": "Quelle actrice joue Juli dans Flipped ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Madeline Carroll", "b": "Chloë Grace Moretz", "c": "Emma Roberts", "d": "Abigail Breslin"}, "fr": {"a": "Madeline Carroll", "b": "Chloë Grace Moretz", "c": "Emma Roberts", "d": "Abigail Breslin"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Juli es interpretada por Madeline Carroll. Callan McAuliffe interpreta a Bryce.", "fr": "Juli est interprétée par Madeline Carroll. Callan McAuliffe joue Bryce."}'::jsonb
WHERE question_key = 'batch_fill:43949:4';

-- ========================================
-- 5. Frankenstein (1062722)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta a la Criatura en Frankenstein de Guillermo del Toro?", "fr": "Quel acteur joue la Créature dans le Frankenstein de Guillermo del Toro ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Oscar Isaac", "b": "Christoph Waltz", "c": "Andrew Garfield", "d": "Jacob Elordi"}, "fr": {"a": "Oscar Isaac", "b": "Christoph Waltz", "c": "Andrew Garfield", "d": "Jacob Elordi"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La Criatura es interpretada por Jacob Elordi. Andrew Garfield fue elegido originalmente pero abandonó el proyecto por conflictos de agenda debido a las huelgas del SAG-AFTRA.", "fr": "La Créature est interprétée par Jacob Elordi. Andrew Garfield avait été initialement choisi mais a quitté le projet en raison de conflits d''emploi du temps liés aux grèves du SAG-AFTRA."}'::jsonb
WHERE question_key = 'batch_fill:1062722:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "En el Frankenstein de del Toro, ¿de dónde recupera Victor los cadáveres?", "fr": "Dans le Frankenstein de del Toro, où Victor récupère-t-il les cadavres ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Hospitales de Londres", "b": "Un campo de batalla de la Guerra de Crimea", "c": "Cementerios de París", "d": "Campos de las Guerras Napoleónicas"}, "fr": {"a": "Hôpitaux de Londres", "b": "Un champ de bataille de la guerre de Crimée", "c": "Cimetières de Paris", "d": "Champs des guerres napoléoniennes"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Victor Frankenstein recupera cadáveres de un campo de batalla de la Guerra de Crimea.", "fr": "Victor Frankenstein récupère des cadavres sur un champ de bataille de la guerre de Crimée."}'::jsonb
WHERE question_key = 'batch_fill:1062722:4';

-- ========================================
-- 6. Marty Supreme (1317288)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió Marty Supreme?", "fr": "Qui a réalisé Marty Supreme ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Benny Safdie", "b": "Damien Chazelle", "c": "Josh Safdie", "d": "Paul Thomas Anderson"}, "fr": {"a": "Benny Safdie", "b": "Damien Chazelle", "c": "Josh Safdie", "d": "Paul Thomas Anderson"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Marty Supreme fue dirigida por Josh Safdie, quien coescribió el guion con Ronald Bronstein.", "fr": "Marty Supreme a été réalisé par Josh Safdie, qui a coécrit le scénario avec Ronald Bronstein."}'::jsonb
WHERE question_key = 'batch_fill:1317288:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué atleta real inspiró Marty Supreme?", "fr": "Quel athlète réel a inspiré Marty Supreme ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Marty Reisman", "b": "Jan-Ove Waldner", "c": "Ichiro Ogimura", "d": "Viktor Barna"}, "fr": {"a": "Marty Reisman", "b": "Jan-Ove Waldner", "c": "Ichiro Ogimura", "d": "Viktor Barna"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La película está libremente inspirada en el campeón estadounidense de tenis de mesa Marty Reisman, una figura legendaria del ping-pong en los años 50.", "fr": "Le film est librement inspiré du champion américain de tennis de table Marty Reisman, une figure légendaire du ping-pong des années 1950."}'::jsonb
WHERE question_key = 'batch_fill:1317288:4';

-- ========================================
-- 7. Mickey 17 (696506)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cómo se llama el planeta que están colonizando en Mickey 17?", "fr": "Comment s''appelle la planète en cours de colonisation dans Mickey 17 ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Asgard", "b": "Helheim", "c": "Niflheim", "d": "Midgard"}, "fr": {"a": "Asgard", "b": "Helheim", "c": "Niflheim", "d": "Midgard"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "El planeta helado que están colonizando se llama Niflheim, nombre tomado del reino de hielo de la mitología nórdica.", "fr": "La planète de glace en cours de colonisation s''appelle Niflheim, du nom du royaume de glace de la mythologie nordique."}'::jsonb
WHERE question_key = 'batch_fill:696506:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta a Kenneth Marshall en Mickey 17?", "fr": "Quel acteur joue Kenneth Marshall dans Mickey 17 ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Steven Yeun", "b": "Toni Collette", "c": "Robert Pattinson", "d": "Mark Ruffalo"}, "fr": {"a": "Steven Yeun", "b": "Toni Collette", "c": "Robert Pattinson", "d": "Mark Ruffalo"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Kenneth Marshall es interpretado por Mark Ruffalo. Marshall es un político megalómano fracasado con planes siniestros para Niflheim.", "fr": "Kenneth Marshall est interprété par Mark Ruffalo. Marshall est un politicien mégalomane raté aux desseins sinistres pour Niflheim."}'::jsonb
WHERE question_key = 'batch_fill:696506:4';

-- ========================================
-- 8. Mystic River (322)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta a Dave Boyle en Mystic River?", "fr": "Quel acteur joue Dave Boyle dans Mystic River ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Kevin Bacon", "b": "Sean Penn", "c": "Tim Robbins", "d": "Laurence Fishburne"}, "fr": {"a": "Kevin Bacon", "b": "Sean Penn", "c": "Tim Robbins", "d": "Laurence Fishburne"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Dave Boyle es interpretado por Tim Robbins, quien ganó el Óscar al Mejor Actor de Reparto por este papel.", "fr": "Dave Boyle est interprété par Tim Robbins, qui a remporté l''Oscar du meilleur acteur dans un second rôle pour ce rôle."}'::jsonb
WHERE question_key = 'batch_fill:322:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "Mystic River está basada en una novela de ¿qué autor?", "fr": "Mystic River est adapté d''un roman de quel auteur ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Stephen King", "b": "Michael Connelly", "c": "James Ellroy", "d": "Dennis Lehane"}, "fr": {"a": "Stephen King", "b": "Michael Connelly", "c": "James Ellroy", "d": "Dennis Lehane"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La película está basada en la novela homónima de Dennis Lehane publicada en 2001. El guion fue escrito por Brian Helgeland.", "fr": "Le film est adapté du roman éponyme de Dennis Lehane publié en 2001. Le scénario a été écrit par Brian Helgeland."}'::jsonb
WHERE question_key = 'batch_fill:322:4';

-- ========================================
-- 9. Novocaine (1195506)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cuál es la condición especial de Nathan Caine en Novocaine?", "fr": "Quelle est la condition spéciale de Nathan Caine dans Novocaine ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Superfuerza", "b": "Incapacidad de sentir dolor", "c": "Pérdida de memoria", "d": "Daltonismo"}, "fr": {"a": "Super force", "b": "Incapacité à ressentir la douleur", "c": "Perte de mémoire", "d": "Daltonisme"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Nathan Caine padece insensibilidad congénita al dolor con anhidrosis (CIPA), una condición rara que le impide sentir cualquier dolor.", "fr": "Nathan Caine souffre d''insensibilité congénitale à la douleur avec anhidrose (CIPA), une maladie rare qui l''empêche de ressentir toute douleur."}'::jsonb
WHERE question_key = 'batch_fill:1195506:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a Sherry en Novocaine?", "fr": "Quelle actrice joue Sherry dans Novocaine ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Betty Gabriel", "b": "Amber Midthunder", "c": "Jenna Ortega", "d": "Sydney Sweeney"}, "fr": {"a": "Betty Gabriel", "b": "Amber Midthunder", "c": "Jenna Ortega", "d": "Sydney Sweeney"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Sherry Margrave es interpretada por Amber Midthunder. Sherry es la compañera de trabajo e interés amoroso de Nathan.", "fr": "Sherry Margrave est interprétée par Amber Midthunder. Sherry est la collègue et l''intérêt amoureux de Nathan."}'::jsonb
WHERE question_key = 'batch_fill:1195506:4';

-- ========================================
-- 10. Scream 2 (4233)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cómo se llama la película de terror inspirada en los eventos de Woodsboro en Scream 2?", "fr": "Comment s''appelle le film d''horreur inspiré des événements de Woodsboro dans Scream 2 ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Slash", "b": "Stab", "c": "Scream", "d": "Killer"}, "fr": {"a": "Slash", "b": "Stab", "c": "Scream", "d": "Killer"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La película dentro de la película se llama \"Stab\" y está inspirada en los eventos reales de Woodsboro.", "fr": "Le film dans le film s''appelle \"Stab\" et est inspiré des événements réels de Woodsboro."}'::jsonb
WHERE question_key = 'batch_fill:4233:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a Mrs. Loomis, una de las asesinas en Scream 2?", "fr": "Quelle actrice joue Mrs. Loomis, l''une des tueuses dans Scream 2 ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Neve Campbell", "b": "Courteney Cox", "c": "Sarah Michelle Gellar", "d": "Laurie Metcalf"}, "fr": {"a": "Neve Campbell", "b": "Courteney Cox", "c": "Sarah Michelle Gellar", "d": "Laurie Metcalf"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Mrs. Loomis (bajo el alias de Debbie Salt) es interpretada por Laurie Metcalf. Es la madre del asesino de la primera película, Billy Loomis.", "fr": "Mrs. Loomis (sous l''alias de Debbie Salt) est interprétée par Laurie Metcalf. Elle est la mère du tueur du premier film, Billy Loomis."}'::jsonb
WHERE question_key = 'batch_fill:4233:4';

-- ========================================
-- 11. Sisu (840326)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué apodo le da el Ejército Rojo a Aatami Korpi en Sisu?", "fr": "Quel surnom l''Armée rouge donne-t-elle à Aatami Korpi dans Sisu ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Ángel de la Muerte", "b": "Soldado Fantasma", "c": "Koschei (El Inmortal)", "d": "Lobo del Norte"}, "fr": {"a": "L''Ange de la Mort", "b": "Le Soldat Fantôme", "c": "Koschei (L''Immortel)", "d": "Le Loup du Nord"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "El Ejército Rojo de Stalin apodó a Aatami \"Koschei\", que significa \"El Inmortal\", porque parecía imposible matarlo.", "fr": "L''Armée rouge de Staline a surnommé Aatami \"Koschei\", signifiant \"L''Immortel\", car il semblait impossible à tuer."}'::jsonb
WHERE question_key = 'batch_fill:840326:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Durante qué guerra se desarrolla Sisu?", "fr": "Pendant quelle guerre se déroule Sisu ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "La Guerra de Invierno", "b": "La Guerra de Continuación", "c": "La Guerra de Laponia", "d": "La Primera Guerra Mundial"}, "fr": {"a": "La Guerre d''Hiver", "b": "La Guerre de Continuation", "c": "La Guerre de Laponie", "d": "La Première Guerre mondiale"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La película se desarrolla durante la Guerra de Laponia entre Finlandia y la Alemania nazi en 1944.", "fr": "Le film se déroule pendant la guerre de Laponie entre la Finlande et l''Allemagne nazie en 1944."}'::jsonb
WHERE question_key = 'batch_fill:840326:4';

-- ========================================
-- 12. The Faculty (9276)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta a Zeke, el traficante de drogas, en The Faculty?", "fr": "Quel acteur joue Zeke, le dealer, dans The Faculty ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Elijah Wood", "b": "Shawn Hatosy", "c": "Usher Raymond", "d": "Josh Hartnett"}, "fr": {"a": "Elijah Wood", "b": "Shawn Hatosy", "c": "Usher Raymond", "d": "Josh Hartnett"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Zeke es interpretado por Josh Hartnett. Zeke es un traficante de drogas en la escuela que se convierte en uno de los estudiantes que luchan contra la invasión alienígena.", "fr": "Zeke est interprété par Josh Hartnett. Zeke est un dealer au lycée qui devient l''un des élèves combattant l''invasion extraterrestre."}'::jsonb
WHERE question_key = 'batch_fill:9276:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió The Faculty?", "fr": "Qui a réalisé The Faculty ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Wes Craven", "b": "Kevin Williamson", "c": "Robert Rodriguez", "d": "John Carpenter"}, "fr": {"a": "Wes Craven", "b": "Kevin Williamson", "c": "Robert Rodriguez", "d": "John Carpenter"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "The Faculty fue dirigida por Robert Rodriguez. El guion fue escrito por Kevin Williamson, el escritor de la franquicia Scream.", "fr": "The Faculty a été réalisé par Robert Rodriguez. Le scénario a été écrit par Kevin Williamson, le scénariste de la franchise Scream."}'::jsonb
WHERE question_key = 'batch_fill:9276:4';

-- ========================================
-- 13. The Fifth Element (18)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cuál es la profesión de Korben Dallas en The Fifth Element?", "fr": "Quel est le métier de Korben Dallas dans The Fifth Element ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Policía", "b": "Taxista", "c": "Piloto", "d": "Soldado"}, "fr": {"a": "Policier", "b": "Chauffeur de taxi", "c": "Pilote", "d": "Soldat"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Korben Dallas es un excomandante de fuerzas especiales que ahora trabaja como taxista.", "fr": "Korben Dallas est un ancien commandant des forces spéciales qui travaille désormais comme chauffeur de taxi."}'::jsonb
WHERE question_key = 'batch_fill:18:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién inventó el ''Lenguaje Divino'' que habla Leeloo en The Fifth Element?", "fr": "Qui a inventé le ''Langage Divin'' parlé par Leeloo dans The Fifth Element ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Milla Jovovich", "b": "Un equipo de lingüistas", "c": "Luc Besson", "d": "Bruce Willis"}, "fr": {"a": "Milla Jovovich", "b": "Une équipe de linguistes", "c": "Luc Besson", "d": "Bruce Willis"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "El Lenguaje Divino fue inventado por el director Luc Besson y desarrollado junto con Milla Jovovich. Al final del rodaje, podían mantener conversaciones completas en ese idioma.", "fr": "Le Langage Divin a été inventé par le réalisateur Luc Besson et développé avec Milla Jovovich. À la fin du tournage, ils pouvaient tenir des conversations entières dans cette langue."}'::jsonb
WHERE question_key = 'batch_fill:18:4';

-- ========================================
-- 14. The Giver (227156)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cuál es el eufemismo usado para quienes abandonan la comunidad en The Giver?", "fr": "Quel est l''euphémisme utilisé pour ceux qui quittent la communauté dans The Giver ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Viaje a la Libertad", "b": "Liberado a Otro Lugar", "c": "Nuevo Comienzo", "d": "El Gran Pasaje"}, "fr": {"a": "Voyage vers la Liberté", "b": "Libéré vers l''Ailleurs", "c": "Nouveau Départ", "d": "Le Grand Passage"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La comunidad utiliza la expresión ''Liberado a Otro Lugar'', que Jonas descubre que en realidad es un eufemismo para la eutanasia.", "fr": "La communauté utilise l''expression ''Libéré vers l''Ailleurs'', dont Jonas découvre qu''il s''agit en réalité d''un euphémisme pour l''euthanasie."}'::jsonb
WHERE question_key = 'batch_fill:227156:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a la Anciana Mayor en The Giver?", "fr": "Quelle actrice joue la Doyenne dans The Giver ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Katie Holmes", "b": "Meryl Streep", "c": "Jodie Foster", "d": "Cate Blanchett"}, "fr": {"a": "Katie Holmes", "b": "Meryl Streep", "c": "Jodie Foster", "d": "Cate Blanchett"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La Anciana Mayor es interpretada por Meryl Streep. Streep interpreta a la líder autoritaria que mantiene el control sobre la comunidad.", "fr": "La Doyenne est interprétée par Meryl Streep. Streep incarne la dirigeante autoritaire qui maintient le contrôle sur la communauté."}'::jsonb
WHERE question_key = 'batch_fill:227156:4';

-- ========================================
-- 15. The Hunt (103663)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué premio ganó Mads Mikkelsen por interpretar a Lucas en The Hunt?", "fr": "Quel prix Mads Mikkelsen a-t-il remporté pour son rôle de Lucas dans The Hunt ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Globo de Oro - Mejor Actor", "b": "BAFTA - Mejor Actor", "c": "Cannes - Mejor Actor", "d": "Óscar - Mejor Actor"}, "fr": {"a": "Golden Globe - Meilleur acteur", "b": "BAFTA - Meilleur acteur", "c": "Cannes - Meilleur acteur", "d": "Oscar - Meilleur acteur"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Mads Mikkelsen ganó el premio al Mejor Actor en el 65.º Festival de Cine de Cannes por su actuación en este papel.", "fr": "Mads Mikkelsen a remporté le prix du meilleur acteur au 65e Festival de Cannes pour sa performance dans ce rôle."}'::jsonb
WHERE question_key = 'batch_fill:103663:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió The Hunt?", "fr": "Qui a réalisé The Hunt ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Lars von Trier", "b": "Nicolas Winding Refn", "c": "Susanne Bier", "d": "Thomas Vinterberg"}, "fr": {"a": "Lars von Trier", "b": "Nicolas Winding Refn", "c": "Susanne Bier", "d": "Thomas Vinterberg"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La película fue dirigida por Thomas Vinterberg, uno de los fundadores del movimiento Dogma 95.", "fr": "Le film a été réalisé par Thomas Vinterberg, l''un des fondateurs du mouvement Dogme 95."}'::jsonb
WHERE question_key = 'batch_fill:103663:4';

-- ========================================
-- 16. The Quick and the Dead (12106)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cómo se llama el pueblo en The Quick and the Dead?", "fr": "Comment s''appelle la ville dans The Quick and the Dead ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Tombstone", "b": "Redemption", "c": "Deadwood", "d": "Salvation"}, "fr": {"a": "Tombstone", "b": "Redemption", "c": "Deadwood", "d": "Salvation"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "El pueblo se llama Redemption y está gobernado con puño de hierro por John Herod.", "fr": "La ville s''appelle Redemption et est gouvernée d''une main de fer par John Herod."}'::jsonb
WHERE question_key = 'batch_fill:12106:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actor interpreta al joven pistolero ''The Kid'' en The Quick and the Dead?", "fr": "Quel acteur joue le jeune tireur ''The Kid'' dans The Quick and the Dead ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Russell Crowe", "b": "Brad Pitt", "c": "Leonardo DiCaprio", "d": "Keanu Reeves"}, "fr": {"a": "Russell Crowe", "b": "Brad Pitt", "c": "Leonardo DiCaprio", "d": "Keanu Reeves"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "''The Kid'' es interpretado por un joven Leonardo DiCaprio, en uno de sus primeros papeles.", "fr": "''The Kid'' est interprété par un jeune Leonardo DiCaprio, dans l''un de ses premiers rôles."}'::jsonb
WHERE question_key = 'batch_fill:12106:4';

-- ========================================
-- 17. Weapons (1078605)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió la película Weapons?", "fr": "Qui a réalisé le film Weapons ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Jordan Peele", "b": "Ari Aster", "c": "Zach Cregger", "d": "Mike Flanagan"}, "fr": {"a": "Jordan Peele", "b": "Ari Aster", "c": "Zach Cregger", "d": "Mike Flanagan"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Weapons fue escrita y dirigida por Zach Cregger.", "fr": "Weapons a été écrit et réalisé par Zach Cregger."}'::jsonb
WHERE question_key = 'batch_fill:1078605:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Cuántos niños huyen misteriosamente de sus hogares la misma noche en Weapons?", "fr": "Combien d''enfants fuguent mystérieusement de chez eux la même nuit dans Weapons ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Siete", "b": "Doce", "c": "Diecisiete", "d": "Veintiuno"}, "fr": {"a": "Sept", "b": "Douze", "c": "Dix-sept", "d": "Vingt et un"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Diecisiete niños de la misma clase huyen misteriosamente de sus hogares a las 2:17 de la madrugada la misma noche.", "fr": "Dix-sept enfants de la même classe fuguent mystérieusement de chez eux à 2h17 du matin la même nuit."}'::jsonb
WHERE question_key = 'batch_fill:1078605:4';

-- ========================================
-- 18. Wolfs (877817)
-- ========================================
UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Quién dirigió la película Wolfs?", "fr": "Qui a réalisé le film Wolfs ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Steven Soderbergh", "b": "Jon Watts", "c": "Guy Ritchie", "d": "David Leitch"}, "fr": {"a": "Steven Soderbergh", "b": "Jon Watts", "c": "Guy Ritchie", "d": "David Leitch"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "Wolfs fue escrita y dirigida por Jon Watts, también conocido por la trilogía de Spider-Man: Homecoming.", "fr": "Wolfs a été écrit et réalisé par Jon Watts, également connu pour la trilogie Spider-Man: Homecoming."}'::jsonb
WHERE question_key = 'batch_fill:877817:3';

UPDATE question_pool_questions
SET
  question_translations = question_translations || '{"es": "¿Qué actriz interpreta a la política cuyo accidente desencadena los eventos en Wolfs?", "fr": "Quelle actrice joue la politicienne dont l''accident déclenche les événements dans Wolfs ?"}'::jsonb,
  options_translations = options_translations || '{"es": {"a": "Poorna Jagannathan", "b": "Sandra Bullock", "c": "Amy Ryan", "d": "Julia Roberts"}, "fr": {"a": "Poorna Jagannathan", "b": "Sandra Bullock", "c": "Amy Ryan", "d": "Julia Roberts"}}'::jsonb,
  explanation_translations = explanation_translations || '{"es": "La política es interpretada por Amy Ryan. Su accidente en la habitación de hotel reúne a los dos profesionales.", "fr": "La politicienne est interprétée par Amy Ryan. Son accident dans la chambre d''hôtel réunit les deux nettoyeurs professionnels."}'::jsonb
WHERE question_key = 'batch_fill:877817:4';
