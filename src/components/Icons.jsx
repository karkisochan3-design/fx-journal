import React from 'react';

const base = (p) => ({
  width: p.size || 18,
  height: p.size || 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: p.weight || 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...p.rest,
});

const S = (paths) =>
  function Icon(props) {
    return (
      <svg {...base(props)} aria-hidden="true">
        {paths}
      </svg>
    );
  };

export const IconDashboard = S(
  <>
    <rect x="3" y="3" width="7.5" height="8.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
    <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="2" />
    <rect x="3" y="14" width="7.5" height="7" rx="2" />
  </>
);

export const IconTrades = S(
  <>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </>
);

export const IconPlus = S(<>
  <path d="M12 5v14M5 12h14" />
</>);

export const IconAnalytics = S(<>
  <path d="M3 3v18h18" />
  <path d="M7 15l3.5-4 3 2.5L20 7" />
</>);

export const IconSun = S(<>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
</>);

export const IconMoon = S(
  <path d="M21 12.8A8.5 8.5 0 1111.2 3a6.6 6.6 0 009.8 9.8z" />
);

export const IconSearch = S(<>
  <circle cx="11" cy="11" r="7" />
  <path d="M20 20l-3.5-3.5" />
</>);

export const IconX = S(<>
  <path d="M18 6L6 18M6 6l12 12" />
</>);

export const IconEdit = S(<>
  <path d="M12 20h9" />
  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
</>);

export const IconTrash = S(<>
  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  <path d="M10 11v5M14 11v5" />
</>);

export const IconCheck = S(<path d="M20 6L9 17l-5-5" />);

export const IconDownload = S(<>
  <path d="M12 3v12M7 10l5 5 5-5" />
  <path d="M4 21h16" />
</>);

export const IconUpload = S(<>
  <path d="M12 21V9M7 14l5-5 5 5" />
  <path d="M4 3h16" />
</>);

export const IconTarget = S(<>
  <circle cx="12" cy="12" r="9" />
  <circle cx="12" cy="12" r="5" />
  <circle cx="12" cy="12" r="1.4" />
</>);

export const IconFilter = S(<path d="M3 5h18l-7 8v6l-4 2v-8z" />);

export const IconLogout = S(<>
  <path d="M15 17l5-5-5-5" />
  <path d="M20 12H9" />
  <path d="M12 3H5v18h7" />
</>);

export const IconAlert = S(<>
  <path d="M12 9v4M12 17h.01" />
  <path d="M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
</>);

export const IconChevron = S(<path d="M9 6l6 6-6 6" />);

export const IconLock = S(<>
  <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
  <path d="M8 10.5V7a4 4 0 018 0v3.5" />
</>);

export const IconSpark = S(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />);

export const IconClock = S(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 7v5l3.2 2" />
</>);

export const IconRefresh = S(<>
  <path d="M21 12a9 9 0 11-3-6.7" />
  <path d="M21 4v5h-5" />
</>);
