import { db } from './index';
import { postsTable, materialsTable } from './schema';
import fs from 'fs';
import path from 'path';

export async function seedContent() {
  const existingPosts = db.select().from(postsTable).all();
  if (existingPosts.length === 0) {
    db.insert(postsTable).values([
      {
        title: "The Architecture of Somatic Anxiety: Moving from Resistance to Grounded Presence",
        slug: "architecture-of-somatic-anxiety",
        excerpt: "Anxiety is not merely a mental preoccupation; it is a physiological alarm echoing through the autonomic nervous system. Here is how somatic clinical awareness enables gentle regulation.",
        content: `When clients enter my practice in Addis Ababa describing overwhelming worry, they often focus exclusively on cognitive looping—the repetitive "what-ifs" that exhaust the intellect. Yet, in clinical psychology, we understand that cognition is frequently the trailing symptom of a nervous system stuck in acute sympathetic hyperarousal.

### The Nervous System Alarm

When we experience sensory or relational overwhelm, our autonomic nervous system perceives an implicit threat to emotional safety. The diaphragm tenses, heart rate variability narrows, and the prefrontal cortex temporarily yields command to the survival circuits of the amygdala.

Attempting to argue rationally with an escalated nervous system is akin to reasoning with a smoke detector while the alarm is blaring. Before cognitive restructuring can occur, the physical body requires unambiguous physiological evidence of safety.

### Three Grounding Techniques That Work Immediately

1. **The Extended Exhale**: Inhale gently through the nose for 4 counts, then prolong the exhalation through pursed lips for 7 counts. This activates the vagus nerve and down-regulates cardiac pacing.
2. **Orienting to Ambient Space**: Slowly turn your head from left to right, allowing your vision to settle on three neutral objects in your physical room. Name them aloud. This signals to your brain stem that the immediate horizon is secure.
3. **Tactile Grounding**: Place both feet flat upon the floor, feeling the downward gravitational pull. Notice the stability of the ground underneath you.

Healing is not the elimination of emotional friction; it is expanding our capacity to remain grounded while friction passes through.`,
        category: "Therapy & Insights",
        authorName: "Dr. Hana Almaz",
        readTimeMin: 4,
        published: true,
        tags: "anxiety,somatic-awareness,mindfulness,emotional-regulation",
      },
      {
        title: "Navigating High-Stakes Career Stress & Chronic Burnout in Addis Ababa",
        slug: "navigating-career-stress-and-burnout",
        excerpt: "In a rapidly evolving metropolitan culture, the pressure to perpetually produce can insidiously erode personal boundaries, physical endurance, and clinical well-being.",
        content: `Burnout is not an individual character flaw or a failure of motivation. It is the natural consequence of chronic, unmitigated exposure to high cognitive demands in the absence of intentional psychological restoration.

### Recognizing the Warning Signals

Many high-performing professionals mistake functional exhaustion for ordinary fatigue. True burnout presents across three distinct clinical dimensions:

- **Emotional Depletion**: A persistent sense of emptiness where even routine interpersonal interactions feel burdensome.
- **Depersonalization / Cynicism**: Developing an emotional detachment or irritable skepticism toward colleagues, family, and personal goals.
- **Reduced Sense of Efficacy**: A nagging internal narrative that regardless of exertion, nothing is truly adequate.

### Boundaries as Preventive Health

Boundaries are not barriers that isolate us from the world; they are the structural framework that makes sustainable engagement possible. To protect your well-being:

1. Establish clear demarcations between occupational responsiveness and domestic restoration.
2. Practice unconditional downtime without productivity guilt.
3. Seek safe clinical dialogue where you do not need to perform or project mastery.`,
        category: "Stress & Burnout",
        authorName: "Dr. Hana Almaz",
        readTimeMin: 5,
        published: true,
        tags: "burnout,work-life,boundaries,resilience",
      },
      {
        title: "Cultivating Emotional Literacy: How Naming Feelings Transforms Relationships",
        slug: "cultivating-emotional-literacy",
        excerpt: "When we lack nuanced vocabulary for our internal world, unexpressed distress inevitably translates into somatic tension, avoidance, or interpersonal defensiveness.",
        content: `Psychologist Dan Siegel famously coined the phrase "Name it to tame it." Neuroscience confirms that when we accurately verbalize an intense affective state, neural activation shifts from the reactive amygdala toward the reflective right ventrolateral prefrontal cortex.

### Moving Beyond "Fine" or "Angry"

Often in cultural dialogue, we compress rich emotional tapestries into simplistic terms: we are either "fine" or "upset." But underneath irritation frequently lies hurt; behind withdrawal lies a longing for validation; beneath perfectionism lies profound fear of rejection.

By cultivating emotional granularity, we stop reacting blindly to our emotional storms and start deciphering their underlying needs. In close relationships, stating *"I feel overwhelmed and unsupported right now"* invites connection, whereas *"You never care"* invites defense.`,
        category: "Interpersonal Dynamics",
        authorName: "Dr. Hana Almaz",
        readTimeMin: 4,
        published: true,
        tags: "communication,relationships,emotional-intelligence",
      }
    ]).run();
  }

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Create lightweight placeholder PDF documents for downloadable clinical tools
  const createSimplePdf = (filePath: string, title: string, subtitle: string) => {
    if (!fs.existsSync(filePath)) {
      const pdfContent = `%PDF-1.4
1 0 obj
<< /Title (${title}) /Author (Dr. Hana Almaz - Mentalweg) >>
endobj
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>
endobj
5 0 obj
<< /Length 200 >>
stream
BT
/F1 20 Tf
50 720 Td
(${title}) Tj
/F1 12 Tf
0 -30 Td
(${subtitle}) Tj
0 -25 Td
(Mentalweg Clinical Psychology Practice - Dr. Hana Almaz) Tj
0 -20 Td
(Bulgaria Corridor Sanctuary, Addis Ababa, Ethiopia) Tj
ET
endstream
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000085 00000 n 
0000000135 00000 n 
0000000195 00000 n 
0000000318 00000 n 
0000000570 00000 n 
trailer
<< /Size 7 /Root 2 0 R /Info 1 0 R >>
startxref
645
%%EOF`;
      fs.writeFileSync(filePath, pdfContent);
    }
  };

  createSimplePdf(
    path.join(uploadsDir, 'Daily_Thought_Record_Worksheet.pdf'),
    'Daily Compassionate Thought-Record',
    'Cognitive Restructuring Worksheet & Balanced Perspectives Guide'
  );
  createSimplePdf(
    path.join(uploadsDir, 'Somatic_Grounding_Protocol.pdf'),
    'Somatic Grounding & Sensory Reset Guide',
    '5-4-3-2-1 Sensory Grounding and Acute Anxiety Regulation Protocol'
  );
  createSimplePdf(
    path.join(uploadsDir, 'Values_Aligned_Living_Audit.pdf'),
    'Values-Aligned Living Audit',
    'Acceptance and Commitment Therapy (ACT) Self-Reflection Template'
  );
  createSimplePdf(
    path.join(uploadsDir, 'Sleep_Hygiene_Checklist.pdf'),
    'Sleep Architecture & Circadian Hygiene Checklist',
    'Non-Pharmacological Behavioral Protocol for Restorative Sleep'
  );

  const existingMaterials = db.select().from(materialsTable).all();
  if (existingMaterials.length === 0) {
    db.insert(materialsTable).values([
      {
        title: "Daily Compassionate Thought-Record (CBT Worksheet)",
        description: "A structured cognitive restructuring tool designed to help you identify automatic negative thoughts, evaluate cognitive distortions, and construct grounded balanced alternative perspectives.",
        fileName: "Daily_Thought_Record_Worksheet.pdf",
        fileUrl: "/uploads/Daily_Thought_Record_Worksheet.pdf",
        fileSize: "420 KB",
        fileType: "pdf",
        category: "Clinical Worksheet",
        downloadCount: 14,
        published: true,
      },
      {
        title: "Somatic Grounding & Nervous System Reset Guide",
        description: "A pocket-sized 5-4-3-2-1 sensory grounding protocol and polyvagal breathing exercise for acute panic, situational overwhelm, and grounding during high-stress encounters.",
        fileName: "Somatic_Grounding_Protocol.pdf",
        fileUrl: "/uploads/Somatic_Grounding_Protocol.pdf",
        fileSize: "280 KB",
        fileType: "pdf",
        category: "Patient Guide",
        downloadCount: 29,
        published: true,
      },
      {
        title: "Values-Aligned Living Audit (ACT Worksheet)",
        description: "An Acceptance and Commitment Therapy exploration template to clarify personal core values across career, relationships, health, and personal growth.",
        fileName: "Values_Aligned_Living_Audit.pdf",
        fileUrl: "/uploads/Values_Aligned_Living_Audit.pdf",
        fileSize: "510 KB",
        fileType: "pdf",
        category: "Self-Reflection",
        downloadCount: 8,
        published: true,
      },
      {
        title: "Sleep Architecture & Circadian Hygiene Checklist",
        description: "Evidence-based non-pharmacological behavioral modifications to optimize sleep onset latency, reduce nocturnal wakefulness, and restore restorative REM sleep.",
        fileName: "Sleep_Hygiene_Checklist.pdf",
        fileUrl: "/uploads/Sleep_Hygiene_Checklist.pdf",
        fileSize: "310 KB",
        fileType: "pdf",
        category: "Psychoeducation",
        downloadCount: 19,
        published: true,
      }
    ]).run();
  }
}
