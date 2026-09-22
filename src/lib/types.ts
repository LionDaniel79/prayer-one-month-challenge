export type SamOption = {
  id: string;
  name: string;
  leaderName: string;
};

export type ProfileData = {
  displayName: string;
  samId: string | null;
  samName: string | null;
  samLeaderName: string | null;
};

export type MemberDashboard = {
  today: string;
  user: {
    displayName: string;
    samName: string | null;
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
