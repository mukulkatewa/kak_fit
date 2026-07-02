import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type DailyExerciseReminderEmailProps = {
  name: string;
  appUrl: string;
  workoutCount: number;
  lastWorkoutName?: string | null;
  lastWorkoutDate?: string | null;
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function DailyExerciseReminderEmail({
  name,
  appUrl,
  workoutCount,
  lastWorkoutName,
  lastWorkoutDate,
}: DailyExerciseReminderEmailProps) {
  const displayName = firstName(name);
  const hasHistory = workoutCount > 0;
  const preview = hasHistory
    ? `${displayName}, keep your training rhythm alive today.`
    : `${displayName}, your first logged workout is waiting.`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandRow}>
            <Text style={brandMark}>Kak Fit</Text>
          </Section>

          <Heading style={heading}>A small nudge for today, {displayName}.</Heading>

          <Text style={lead}>
            Ten focused minutes is enough to keep the promise you made to yourself. Open Kak Fit, start a simple session, and log what you actually do. No perfect workout required.
          </Text>

          <Section style={card}>
            <Text style={cardLabel}>Your training note</Text>
            {hasHistory ? (
              <Text style={cardText}>
                You have logged <strong>{workoutCount}</strong> workout{workoutCount === 1 ? "" : "s"}
                {lastWorkoutName ? `, most recently ${lastWorkoutName}` : ""}
                {lastWorkoutDate ? ` on ${lastWorkoutDate}` : ""}. Keep that thread going today.
              </Text>
            ) : (
              <Text style={cardText}>
                Start with one exercise you know well. Log the first set, then let momentum handle the next one.
              </Text>
            )}
          </Section>

          <Button href={appUrl} style={button}>
            Start today&apos;s workout
          </Button>

          <Hr style={hr} />

          <Text style={footer}>
            You are receiving this because exercise reminders are enabled for your Kak Fit account. You can turn them off from app settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyExerciseReminderEmail;

const body = {
  margin: 0,
  backgroundColor: "#070A0F",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container = {
  width: "100%",
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 20px",
};

const brandRow = {
  marginBottom: "28px",
};

const brandMark = {
  color: "#FFFFFF",
  fontSize: "18px",
  fontWeight: "800",
  margin: 0,
};

const heading = {
  color: "#FFFFFF",
  fontSize: "34px",
  lineHeight: "40px",
  fontWeight: "800",
  letterSpacing: "0",
  margin: "0 0 16px",
};

const lead = {
  color: "#B9C0CC",
  fontSize: "16px",
  lineHeight: "25px",
  margin: "0 0 24px",
};

const card = {
  backgroundColor: "#111722",
  border: "1px solid #273142",
  borderRadius: "8px",
  padding: "18px 18px",
  margin: "0 0 24px",
};

const cardLabel = {
  color: "#4EA3FF",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "800",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};

const cardText = {
  color: "#E7EBF2",
  fontSize: "15px",
  lineHeight: "23px",
  margin: 0,
};

const button = {
  display: "block",
  backgroundColor: "#1794FF",
  borderRadius: "8px",
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: "800",
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "14px 18px",
};

const hr = {
  borderColor: "#232B38",
  margin: "28px 0 16px",
};

const footer = {
  color: "#7C8594",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
};
