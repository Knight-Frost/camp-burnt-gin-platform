<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — conversation threads and messages covering all inbox features.
 *
 * Human conversation threads (10):
 *   T01 — Sarah Johnson  → application confirmation for Ethan (admin replies)
 *   T02 — Michael Williams → Ava's insulin pump requirements (admin + medical reply)
 *   T03 — Jennifer Thompson → why was Noah's application rejected?
 *   T04 — David Martinez   → Sofia's catheterization protocol at camp
 *   T05 — Grace Wilson      → Tyler's waitlist status question
 *   T06 — Anthony Campbell  → Penelope's non-verbal AAC device at camp
 *   T07 — Admin → general S1-2026 pre-camp information broadcast
 *   T08 — Archived: Patricia Davis re Mia's 2025 medications (is_archived=true)
 *   T09 — Trashed: duplicate question from Sarah Johnson (trashed by Sarah)
 *   T10 — Multi-turn: Robert Anderson re Emma's g-tube positioning
 *
 * System notification threads (4):
 *   SYS01 — Ethan Johnson application → approved (Sarah's inbox)
 *   SYS02 — Lucas Williams application → pending review (Michael's inbox)
 *   SYS03 — Noah Thompson application → rejected (Jennifer's inbox)
 *   SYS04 — Chloe Rodriguez application → waitlisted (Lisa's inbox)
 *
 * Read receipt + inbox feature states exercised:
 *   - Unread messages (no receipts) — several threads have messages the applicant hasn't read
 *   - Starred conversation — Sarah has T01 starred
 *   - Important flag — Michael has T02 marked important
 *   - Trashed — Sarah has T09 in trash folder
 *   - Archived — T08 is_archived = true
 *   - Admin-side read receipts — admin has read all applicant messages
 */
class MessagingSeeder extends Seeder
{
    public function run(): void
    {
        $admin   = User::where('email', 'admin@example.com')->firstOrFail();
        $admin2  = User::where('email', 'admin2@campburntgin.org')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();

        // Applicant users
        $sarah    = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $michael  = User::where('email', 'michael.williams@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $david    = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $grace    = User::where('email', 'grace.wilson@example.com')->firstOrFail();
        $anthony  = User::where('email', 'anthony.campbell@example.com')->firstOrFail();
        $patricia = User::where('email', 'patricia.davis@example.com')->firstOrFail();
        $robert   = User::where('email', 'robert.anderson@example.com')->firstOrFail();
        $lisa     = User::where('email', 'lisa.rodriguez@example.com')->firstOrFail();

        // Sessions & campers
        $session1 = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2 = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();
        $session1Past = CampSession::where('name', 'Session 1 — Summer 2025')->firstOrFail();

        $ethan   = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $ava     = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas   = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $noah    = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $sofia   = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $tyler   = Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail();
        $penny   = Camper::where('first_name', 'Penelope')->where('last_name', 'Campbell')->firstOrFail();
        $mia     = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $emma    = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        $chloe   = Camper::where('first_name', 'Chloe')->where('last_name', 'Rodriguez')->firstOrFail();

        $appEthan  = Application::where('camper_id', $ethan->id)->where('camp_session_id', $session1->id)->first();
        $appAva    = Application::where('camper_id', $ava->id)->where('camp_session_id', $session2->id)->first();
        $appLucas  = Application::where('camper_id', $lucas->id)->where('camp_session_id', $session1->id)->first();
        $appNoah   = Application::where('camper_id', $noah->id)->where('camp_session_id', $session1->id)->first();
        $appSofia  = Application::where('camper_id', $sofia->id)->where('camp_session_id', $session1->id)->first();
        $appChloe  = Application::where('camper_id', $chloe->id)->where('camp_session_id', $session1->id)->first();
        $appMia25  = Application::where('camper_id', $mia->id)->where('camp_session_id', $session1Past->id)->first();

        // ── T01: Sarah → Ethan application confirmation ───────────────────────
        if (! Conversation::where('subject', 'Re: Ethan\'s Summer 2026 Application — confirmation')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $sarah->id,
                'subject'         => 'Re: Ethan\'s Summer 2026 Application — confirmation',
                'category'        => 'Application',
                'application_id'  => $appEthan?->id,
                'camper_id'       => $ethan->id,
                'camp_session_id' => $session1->id,
                'last_message_at' => now()->subHours(14),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $sarah,  now()->subDays(4), is_starred: true);
            $this->addParticipant($conv, $admin,  now()->subDays(4));

            $m1 = $this->addMessage($conv, $sarah, now()->subDays(4),
                "Hello,\n\nI submitted Ethan's application for Session 1 — Summer 2026 yesterday. I just wanted to confirm you received everything and ask approximately how long the review process takes?\n\nThank you so much,\nSarah Johnson");
            $m2 = $this->addMessage($conv, $admin, now()->subDays(3),
                "Hi Sarah,\n\nThank you for reaching out! Yes, we received Ethan's application and it is currently in our review queue. Our medical team typically completes the initial review within 5-7 business days.\n\nEthan has been with us before, so our team already has background familiarity with his needs, which should help the process move smoothly.\n\nWe'll send you an email and inbox notification as soon as the review is complete. Feel free to reach out if you have any questions in the meantime.\n\nBest regards,\nAlex Rivera\nCamp Burnt Gin Registration");
            $m3 = $this->addMessage($conv, $sarah, now()->subHours(14),
                "Thank you so much for the update! We're really excited for this summer. Ethan has been talking about camp since January. Looking forward to hearing from you!");

            // Admin has read all messages; Sarah has read admin's reply
            $m1->markAsReadBy($admin);
            $m2->markAsReadBy($sarah);
            $m3->markAsReadBy($admin);
        }

        // ── T02: Michael Williams → Ava's insulin pump requirements ──────────
        if (! Conversation::where('subject', 'Question about Ava\'s OmniPod insulin pump at camp')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $michael->id,
                'subject'         => 'Question about Ava\'s OmniPod insulin pump at camp',
                'category'        => 'Medical',
                'application_id'  => $appAva?->id,
                'camper_id'       => $ava->id,
                'last_message_at' => now()->subHours(2),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $michael, now()->subDays(6), is_important: true);
            $this->addParticipant($conv, $admin,   now()->subDays(6));
            $this->addParticipant($conv, $medical, now()->subDays(5));

            $m1 = $this->addMessage($conv, $michael, now()->subDays(6),
                "Hello,\n\nAva uses the OmniPod 5 system with a Dexcom G7 CGM. I have a few questions before we finalize the application:\n\n1. Do your medical staff have experience managing automated insulin delivery (AID) systems?\n2. What is your protocol when the PDM alarmsOvernight?\n3. Can Ava keep her PDM and CGM receiver with her at all times?\n\nThank you,\nMichael Williams");
            $m2 = $this->addMessage($conv, $admin, now()->subDays(5),
                "Hi Mr. Williams,\n\nThank you for these important questions. I've looped in our Medical Director, Dr. Morgan Chen, who can answer them directly.");
            $m3 = $this->addMessage($conv, $medical, now()->subDays(4),
                "Good afternoon, Mr. Williams,\n\nThank you for the detailed questions — these are exactly the right things to ask.\n\n1. **AID systems**: Yes, our nursing staff have completed training on both OmniPod 5 and Tandem t:slim X2 systems and we support multiple campers with AID technology each session.\n\n2. **Overnight alarms**: Our cabin counselors are trained to wake the on-call nurse immediately for any CGM alert below 70 mg/dL or above 250 mg/dL that the camper cannot self-manage. The on-call nurse remains on site overnight.\n\n3. **Device access**: Absolutely. Ava will have the PDM and CGM receiver with her at all times. We document device locations in our camper daily care plan.\n\nPlease upload the OmniPod settings sheet (basal rates, correction factor, target range) from her endocrinologist when you get a chance.\n\nDr. Morgan Chen, MD\nMedical Director, Camp Burnt Gin");
            $m4 = $this->addMessage($conv, $michael, now()->subHours(2),
                "Dr. Chen, thank you — this is incredibly reassuring. I will upload the endocrinologist's settings sheet today. Is there a specific format you prefer, or is a PDF from the patient portal acceptable?");

            $m1->markAsReadBy($admin);
            $m1->markAsReadBy($medical);
            $m2->markAsReadBy($michael);
            $m2->markAsReadBy($medical);
            $m3->markAsReadBy($michael);
            $m3->markAsReadBy($admin);
            $m4->markAsReadBy($admin);
            $m4->markAsReadBy($medical);
        }

        // ── T03: Jennifer Thompson → why was Noah rejected ────────────────────
        if (! Conversation::where('subject', 'Inquiry about Noah\'s application decision')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $jennifer->id,
                'subject'         => 'Inquiry about Noah\'s application decision',
                'category'        => 'Application',
                'application_id'  => $appNoah?->id,
                'camper_id'       => $noah->id,
                'last_message_at' => now()->subDays(1),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $jennifer, now()->subDays(7));
            $this->addParticipant($conv, $admin,    now()->subDays(7));

            $m1 = $this->addMessage($conv, $jennifer, now()->subDays(7),
                "Hello,\n\nWe received a notification that Noah's application for Session 1 — Summer 2026 was not accepted. I'm hoping to understand the reason so we can address it. Noah attended a session with you before and we thought everything was in order.\n\nCould someone please explain what happened?\n\nThank you,\nJennifer Thompson");
            $m2 = $this->addMessage($conv, $admin, now()->subDays(5),
                "Dear Ms. Thompson,\n\nThank you for reaching out, and I'm sorry for any concern this caused. Noah's application was reviewed carefully by our medical and administrative team.\n\nAfter our medical review, our team determined that Session 1 — Summer 2026 does not have the appropriate staffing ratio to safely support Noah's current cardiac monitoring needs based on the updated information in his application this year. This is not a permanent decision — it is specific to the staffing configuration of this particular session.\n\nI want to flag that Session 2 — Summer 2026 has expanded nursing coverage and we believe it would be an excellent fit. Would you like me to initiate a new application for Noah for Session 2? We would give his case priority review given the Session 1 decision.\n\nPlease don't hesitate to call us at (803) 555-0100 if you'd like to discuss further.\n\nWith care,\nAlex Rivera\nCamp Burnt Gin");
            $m3 = $this->addMessage($conv, $jennifer, now()->subDays(1),
                "Thank you for explaining that, Alex. That makes sense. Yes, please — I'd like to start an application for Session 2. Noah is really eager to come back and so are we.");

            $m1->markAsReadBy($admin);
            $m2->markAsReadBy($jennifer);
            // m3 unread by admin (represents unread inbox item)
        }

        // ── T04: David Martinez → Sofia's CIC protocol ────────────────────────
        if (! Conversation::where('subject', 'Clean Intermittent Catheterization — procedure questions')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $david->id,
                'subject'         => 'Clean Intermittent Catheterization — procedure questions',
                'category'        => 'Medical',
                'camper_id'       => $sofia->id,
                'application_id'  => $appSofia?->id,
                'last_message_at' => now()->subDays(2),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $david,   now()->subDays(10));
            $this->addParticipant($conv, $medical, now()->subDays(10));

            $m1 = $this->addMessage($conv, $david, now()->subDays(10),
                "Good afternoon,\n\nSofia performs CIC four times per day. She is able to do much of this independently with supervision. My questions:\n\n- Will a nurse be available to supervise/assist with CIC on schedule?\n- Do you stock straight catheters (she uses size 10 Fr)? Or should we bring our own supply?\n- Is there a private, accessible restroom near the cabin area?\n\nDavid Martinez");
            $m2 = $this->addMessage($conv, $medical, now()->subDays(8),
                "Hello Mr. Martinez,\n\nThese are great questions and exactly the kind of detail our team needs to prepare Sofia's individualized care plan.\n\n**Nurse supervision**: Yes, our nursing team will be briefed on Sofia's CIC schedule (typically q4h) and a nurse will be available to supervise and assist as needed. We work closely with campers to preserve as much independence as possible.\n\n**Supplies**: We recommend families bring their own catheter supply for the duration of camp to ensure the correct size and brand. We stock emergency supplies but prefer the camper's prescribed kit for routine care. We'll store extras securely in the health center.\n\n**Accessible facilities**: Yes, each cabin cluster has a fully accessible restroom with grab bars and privacy. The health center also has a procedure room designated for personal care needs.\n\nPlease send Sofia's CIC protocol signed by Dr. Owens to ensure our nursing team follows her exact technique.\n\nDr. Morgan Chen");
            $m2->markAsReadBy($david);
            $m1->markAsReadBy($medical);
        }

        // ── T05: Grace Wilson → Tyler's waitlist status ───────────────────────
        if (! Conversation::where('subject', 'Waitlist question for Tyler — Session 1 2026')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $grace->id,
                'subject'         => 'Waitlist question for Tyler — Session 1 2026',
                'category'        => 'Application',
                'camper_id'       => $tyler->id,
                'last_message_at' => now()->subDays(3),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $grace, now()->subDays(3));
            $this->addParticipant($conv, $admin, now()->subDays(3));

            $m1 = $this->addMessage($conv, $grace, now()->subDays(3),
                "Hi,\n\nTyler's application shows \"Under Review.\" I noticed the session capacity warning on the website. Is there a risk he might not get a spot, or are under-review applications guaranteed a place?\n\nGrace Wilson");

            // Message unread by admin to exercise the unread badge
        }

        // ── T06: Anthony Campbell → Penelope's AAC device ────────────────────
        if (! Conversation::where('subject', 'Penelope\'s AAC communication device at camp')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $anthony->id,
                'subject'         => 'Penelope\'s AAC communication device at camp',
                'category'        => 'Medical',
                'camper_id'       => $penny->id,
                'last_message_at' => now()->subDays(1),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $anthony, now()->subDays(8));
            $this->addParticipant($conv, $admin,   now()->subDays(7));
            $this->addParticipant($conv, $medical, now()->subDays(7));

            $m1 = $this->addMessage($conv, $anthony, now()->subDays(8),
                "Hello,\n\nPenelope uses a Tobii Dynavox TD Snap AAC device for all communication. She is non-verbal and this device is essential for expressing her needs and participating in activities. A few questions:\n\n1. Do your counselors have any AAC literacy training?\n2. Can the device go to all activities including water activities?\n3. What happens if the device battery dies overnight?\n\nThank you,\nAnthony Campbell");
            $m2 = $this->addMessage($conv, $admin, now()->subDays(7),
                "Hi Mr. Campbell,\n\nThank you for these important questions — I've forwarded to Dr. Chen and our program director to give you comprehensive answers.");
            $m3 = $this->addMessage($conv, $medical, now()->subDays(1),
                "Hello Mr. Campbell,\n\nPenelope's AAC needs are something we take very seriously.\n\n1. **AAC training**: All counselors attend a pre-camp training session that includes basic AAC literacy — core vocabulary, modeling, and waiting for the device user to respond. We also pair Penelope with a counselor who has prior AAC experience.\n\n2. **Water activities**: Tobii Dynavox devices are not waterproof. We use a waterproof communication board (core vocabulary symbols) for pool and water activities. We've developed these boards in partnership with a speech-language pathologist and they cover the vocabulary needed for the activity. The device will be stored safely at poolside.\n\n3. **Battery management**: We have spare charging cables and will assign a cabin counselor to plug in Penelope's device each evening during dinner so it's fully charged overnight.\n\nWould you be willing to share a brief vocabulary overview so we can load her favorite phrases into the emergency board?\n\nDr. Morgan Chen");
            $m1->markAsReadBy($admin);
            $m1->markAsReadBy($medical);
            $m2->markAsReadBy($anthony);
            $m2->markAsReadBy($medical);
            $m3->markAsReadBy($anthony);
        }

        // ── T07: Admin broadcast — S1-2026 pre-camp information ───────────────
        if (! Conversation::where('subject', 'Important: Session 1 — Summer 2026 Pre-Camp Information')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $admin->id,
                'subject'         => 'Important: Session 1 — Summer 2026 Pre-Camp Information',
                'category'        => 'General',
                'camp_session_id' => $session1->id,
                'last_message_at' => now()->subDays(5),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $admin,   now()->subDays(5));
            $this->addParticipant($conv, $sarah,   now()->subDays(5));
            $this->addParticipant($conv, $michael, now()->subDays(5));

            $m1 = $this->addMessage($conv, $admin, now()->subDays(5),
                "Dear Families,\n\nWe are excited to welcome your campers to Session 1 — Summer 2026 (June 8–12)! Here is key information as we prepare:\n\n**Arrival & Departure**\n- Arrival: Sunday June 8, 1:00–3:00 PM at the main lodge\n- Departure: Friday June 13, 10:00 AM–12:00 PM\n- All medications must be in original labeled containers at check-in\n\n**Medical Check-In**\n- Please plan 30–45 minutes at check-in for our nursing team to verify medications, equipment settings, and care plans\n- If your camper has a g-tube, insulin pump, or BiPAP, please arrive closer to 1:00 PM for priority medical check-in\n\n**What to Bring**\n- A complete medication list signed by your camper's physician\n- At least 10 days of all medications (so counselors have spare supplies for damaged or lost items)\n- All adaptive equipment including chargers, tubing, and replacement supplies\n\n**Contact During Camp**\n- Emergency: (803) 555-0100 (24-hour)\n- Medical questions: medical@campburntgin.org\n- General: admin@campburntgin.org\n\nWe can't wait to see your amazing campers!\n\nThe Camp Burnt Gin Team");

            $m1->markAsReadBy($sarah);
            // Michael hasn't read it yet (unread badge)
        }

        // ── T08: Archived — Patricia Davis 2025 medication thread ─────────────
        if (! Conversation::where('subject', 'Mia\'s Hydroxyurea — 2025 session clarification')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $patricia->id,
                'subject'         => 'Mia\'s Hydroxyurea — 2025 session clarification',
                'category'        => 'Medical',
                'camper_id'       => $mia->id,
                'application_id'  => $appMia25?->id,
                'last_message_at' => now()->subDays(275),
                'is_archived'     => true, // fully archived old thread
            ]);
            $this->addParticipant($conv, $patricia, now()->subDays(310), is_starred: false);
            $this->addParticipant($conv, $medical,  now()->subDays(310));

            $m1 = $this->addMessage($conv, $patricia, now()->subDays(310),
                "Hi, I wanted to confirm the timing for Mia's Hydroxyurea dose during camp — her hematologist recommends it be given in the evening with food. Is that manageable for the nursing schedule?");
            $m2 = $this->addMessage($conv, $medical, now()->subDays(308),
                "Hello Ms. Davis,\n\nAbsolutely — we can schedule Mia's Hydroxyurea for the evening meal medication round. We'll note this as a fixed-time medication in her MAR. No issues at all.\n\nDr. Morgan Chen");
            $m3 = $this->addMessage($conv, $patricia, now()->subDays(275),
                "Perfect, thank you! Camp was wonderful and the nursing team was incredible. We'll definitely apply again.");

            $m1->markAsReadBy($medical);
            $m2->markAsReadBy($patricia);
            $m3->markAsReadBy($medical);
        }

        // ── T09: Trashed — duplicate question from Sarah ──────────────────────
        if (! Conversation::where('subject', 'Ethan\'s application — quick question (duplicate)')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $sarah->id,
                'subject'         => 'Ethan\'s application — quick question (duplicate)',
                'category'        => 'Application',
                'camper_id'       => $ethan->id,
                'last_message_at' => now()->subDays(4),
                'is_archived'     => false,
            ]);
            // Sarah trashed this conversation (sent the duplicate by mistake)
            $this->addParticipant($conv, $sarah, now()->subDays(4), trashed_at: now()->subDays(3));
            $this->addParticipant($conv, $admin, now()->subDays(4));

            $m1 = $this->addMessage($conv, $sarah, now()->subDays(4),
                "Hi, I sent this by mistake — please ignore. I already have a thread open for this.");
        }

        // ── T10: Multi-turn — Robert Anderson → Emma's g-tube positioning ─────
        if (! Conversation::where('subject', 'Emma\'s g-tube site — positioning and activity restrictions')->exists()) {
            $conv = $this->makeConv([
                'created_by_id'   => $robert->id,
                'subject'         => 'Emma\'s g-tube site — positioning and activity restrictions',
                'category'        => 'Medical',
                'camper_id'       => $emma->id,
                'last_message_at' => now()->subHours(6),
                'is_archived'     => false,
            ]);
            $this->addParticipant($conv, $robert,  now()->subDays(12));
            $this->addParticipant($conv, $medical, now()->subDays(12));
            $this->addParticipant($conv, $admin2,  now()->subDays(11));

            $m1 = $this->addMessage($conv, $robert, now()->subDays(12),
                "Hello Dr. Chen,\n\nEmma had a g-tube site revision in February and the stoma is still healing. Her GI doctor has cleared her for camp but asked us to relay a few restrictions:\n\n- No tight harness or seatbelt pressure across the stoma site\n- No lying prone (on her stomach) for exercise activities\n- Granulation tissue — please do not apply silver nitrate without contacting us first\n\nCould you confirm these will be communicated to her cabin staff?\n\nRobert Anderson");
            $m2 = $this->addMessage($conv, $medical, now()->subDays(10),
                "Mr. Anderson,\n\nThank you for this specific information — it's exactly what we need documented before camp.\n\nI have added all three restrictions to Emma's individualized medical care plan and flagged them for her cabin counselors:\n\n1. ✓ No harness/seatbelt pressure across the stoma\n2. ✓ Prone positioning prohibited during all activities\n3. ✓ No silver nitrate application — contact family before any granulation tissue treatment\n\nCould you have Emma's GI doctor send us the February post-op note for our records? Our nursing team will review it at check-in.\n\nDr. Morgan Chen");
            $m3 = $this->addMessage($conv, $robert, now()->subDays(8),
                "Thank you, Dr. Chen. I will request the post-op note from Dr. Patel's office today. Is a fax or secure email better?\n\nAlso — we also use Mic-Key button size 16 Fr × 1.7 cm. I'll bring two replacement kits in case of accidental dislodgement.");
            $m4 = $this->addMessage($conv, $admin2, now()->subDays(7),
                "Hi Mr. Anderson, secure email to medical@campburntgin.org is preferred. Our fax is (803) 555-0101 if the office requires it.\n\nThank you for bringing replacement kits — that's very helpful. Our nursing team is trained on Mic-Key reinsertion.\n\nJordan Blake, Deputy Director");
            $m5 = $this->addMessage($conv, $robert, now()->subHours(6),
                "Dr. Patel's office will fax the note today. Thank you both — we feel very supported going into camp.");

            $m1->markAsReadBy($medical);
            $m1->markAsReadBy($admin2);
            $m2->markAsReadBy($robert);
            $m3->markAsReadBy($medical);
            $m3->markAsReadBy($admin2);
            $m4->markAsReadBy($robert);
            // m5 unread by admin/medical
        }

        // ── System notification threads ───────────────────────────────────────

        // SYS01 — Ethan application approved (Sarah's inbox)
        if (! Conversation::where('system_event_type', 'application.approved')->where('related_entity_id', $appEthan?->id)->exists()) {
            $this->makeSystemConv(
                applicant:        $sarah,
                admin:            $admin,
                subject:          'Your application for Ethan Johnson has been approved',
                eventType:        'application.approved',
                eventCategory:    'Application',
                relatedType:      Application::class,
                relatedId:        $appEthan?->id,
                camperId:         $ethan->id,
                applicationId:    $appEthan?->id,
                sessionId:        $session1->id,
                body:             "Great news! Ethan Johnson's application for Session 1 — Summer 2026 has been approved.\n\nEthan's medical team has reviewed all submitted information and confirmed he is cleared for camp. You will receive a separate welcome packet with packing lists and arrival information.\n\nIf you have questions, please reply to this message or contact us at admin@campburntgin.org.",
                createdAt:        now()->subDays(6),
                readByApplicant:  true,
            );
        }

        // SYS02 — Lucas application pending (Michael's inbox)
        if (! Conversation::where('system_event_type', 'application.received')->where('related_entity_id', $appLucas?->id)->exists()) {
            $this->makeSystemConv(
                applicant:        $michael,
                admin:            $admin,
                subject:          'Application received for Lucas Williams — Session 1, Summer 2026',
                eventType:        'application.received',
                eventCategory:    'Application',
                relatedType:      Application::class,
                relatedId:        $appLucas?->id,
                camperId:         $lucas->id,
                applicationId:    $appLucas?->id,
                sessionId:        $session1->id,
                body:             "Thank you! We have received Lucas Williams's application for Session 1 — Summer 2026.\n\nYour application is currently being reviewed by our medical team. Given Lucas's complex care needs, our Medical Director will personally review the application. This typically takes 5–10 business days.\n\nWe may reach out with questions or requests for additional documentation. Please watch your inbox.\n\nCamp Burnt Gin Medical Team",
                createdAt:        now()->subDays(8),
                readByApplicant:  false, // Michael hasn't read this one yet
            );
        }

        // SYS03 — Noah application rejected (Jennifer's inbox)
        if (! Conversation::where('system_event_type', 'application.rejected')->where('related_entity_id', $appNoah?->id)->exists()) {
            $this->makeSystemConv(
                applicant:        $jennifer,
                admin:            $admin,
                subject:          'Update regarding Noah Thompson\'s application — Session 1, Summer 2026',
                eventType:        'application.rejected',
                eventCategory:    'Application',
                relatedType:      Application::class,
                relatedId:        $appNoah?->id,
                camperId:         $noah->id,
                applicationId:    $appNoah?->id,
                sessionId:        $session1->id,
                body:             "Dear Jennifer Thompson,\n\nAfter careful review, our team is unable to accommodate Noah Thompson in Session 1 — Summer 2026.\n\nThis decision was made based on current session staffing capacity for cardiac monitoring needs. Please know this is not a reflection of Noah's suitability for camp — we encourage you to apply for Session 2, which has expanded medical coverage.\n\nPlease reply to this message or contact us at (803) 555-0100 to discuss Session 2 options.\n\nWe appreciate your trust in Camp Burnt Gin.",
                createdAt:        now()->subDays(10),
                readByApplicant:  true,
            );
        }

        // SYS04 — Chloe application waitlisted (Lisa's inbox)
        $appChloeS1 = Application::where('camper_id', $chloe->id)->where('camp_session_id', $session1->id)->first();
        if (! Conversation::where('system_event_type', 'application.waitlisted')->where('related_entity_id', $appChloeS1?->id)->exists()) {
            $this->makeSystemConv(
                applicant:        $lisa,
                admin:            $admin,
                subject:          'Chloe Rodriguez has been placed on the waitlist — Session 1, Summer 2026',
                eventType:        'application.waitlisted',
                eventCategory:    'Application',
                relatedType:      Application::class,
                relatedId:        $appChloeS1?->id,
                camperId:         $chloe->id,
                applicationId:    $appChloeS1?->id,
                sessionId:        $session1->id,
                body:             "Dear Lisa Rodriguez,\n\nChloe Rodriguez's application for Session 1 — Summer 2026 has been reviewed and approved medically. However, Session 1 has reached its enrollment capacity for campers requiring 1:1 nursing supervision.\n\nChloe has been placed on our priority waitlist. If a space opens — either through a cancellation or expanded staffing — we will notify you immediately and her application will be upgraded to approved status automatically.\n\nWe understand how important this is for your family. We are actively working to expand Session 1 capacity and will update you within 2 weeks.\n\nThank you for your patience,\nCamp Burnt Gin",
                createdAt:        now()->subDays(4),
                readByApplicant:  false,
            );
        }

        $this->command->line('  Messaging seeded (10 human threads + 4 system notification threads).');
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function makeConv(array $attrs): Conversation
    {
        return Conversation::create(array_merge([
            'is_system_generated'    => false,
            'system_event_type'      => null,
            'system_event_category'  => null,
            'related_entity_type'    => null,
            'related_entity_id'      => null,
            'application_id'         => null,
            'camper_id'              => null,
            'camp_session_id'        => null,
            'is_archived'            => false,
            'category'               => 'General',
        ], $attrs));
    }

    private function addParticipant(
        Conversation $conv,
        User $user,
        mixed $joinedAt,
        bool $is_starred = false,
        bool $is_important = false,
        mixed $trashed_at = null,
    ): ConversationParticipant {
        return ConversationParticipant::firstOrCreate(
            ['conversation_id' => $conv->id, 'user_id' => $user->id],
            [
                'joined_at'    => $joinedAt,
                'is_starred'   => $is_starred,
                'is_important' => $is_important,
                'trashed_at'   => $trashed_at,
            ]
        );
    }

    private function addMessage(
        Conversation $conv,
        User $sender,
        mixed $createdAt,
        string $body
    ): Message {
        $msg = Message::create([
            'conversation_id' => $conv->id,
            'sender_id'       => $sender->id,
            'body'            => $body,
            'idempotency_key' => Str::uuid()->toString(),
            'created_at'      => $createdAt,
            'updated_at'      => $createdAt,
        ]);

        // Keep last_message_at up to date
        if (! $conv->last_message_at || $createdAt > $conv->last_message_at) {
            $conv->update(['last_message_at' => $createdAt]);
        }

        return $msg;
    }

    private function makeSystemConv(
        User   $applicant,
        User   $admin,
        string $subject,
        string $eventType,
        string $eventCategory,
        string $relatedType,
        ?int   $relatedId,
        int    $camperId,
        ?int   $applicationId,
        ?int   $sessionId,
        string $body,
        mixed  $createdAt,
        bool   $readByApplicant,
    ): void {
        if ($relatedId === null) {
            return; // application not found, skip
        }

        $conv = Conversation::create([
            'created_by_id'          => $admin->id,
            'subject'                => $subject,
            'category'               => $eventCategory,
            'application_id'         => $applicationId,
            'camper_id'              => $camperId,
            'camp_session_id'        => $sessionId,
            'last_message_at'        => $createdAt,
            'is_archived'            => false,
            'is_system_generated'    => true,
            'system_event_type'      => $eventType,
            'system_event_category'  => $eventCategory,
            'related_entity_type'    => $relatedType,
            'related_entity_id'      => $relatedId,
        ]);

        ConversationParticipant::create([
            'conversation_id' => $conv->id,
            'user_id'         => $applicant->id,
            'joined_at'       => $createdAt,
        ]);

        $msg = Message::create([
            'conversation_id' => $conv->id,
            'sender_id'       => null, // system message, no sender
            'body'            => $body,
            'idempotency_key' => Str::uuid()->toString(),
            'created_at'      => $createdAt,
            'updated_at'      => $createdAt,
        ]);

        if ($readByApplicant) {
            $msg->reads()->create([
                'user_id' => $applicant->id,
                'read_at' => $createdAt,
            ]);
        }
    }
}
