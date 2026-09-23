export type SamOption = {
  id: string;
  name: string;
  leaderName: string;
};

export type ProfileData = {
  displayName: string;
  position: string | null;
  samLabel: string | null;
};

export type MemberDashboard = {
  today: string;
  user: {
    displayName: string;
    position: string | null;
    samLabel: string | null;
  };
  challenge: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  };
  completedDates: string[];
  progress: {
    completed: number;
    eligible: number;
    rate: number;
  };
};
