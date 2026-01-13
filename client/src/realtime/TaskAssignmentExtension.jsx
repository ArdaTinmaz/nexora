import { useEffect, useMemo, useState } from 'react';
import { createSocket } from './socketClient';

const TaskAssignmentExtension = ({ cardId, teamId, projectId, members }) => {
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = createSocket();
    setSocket(s);
    return () => s.disconnect();
  }, []);

  const selectableMembers = useMemo(
    () => members || [],
    [members]
  );

  const assign = () => {
    if (!socket || !assignee) return;
    socket.emit(
      'assignTask',
      {
        cardId,
        teamId,
        projectId,
        assignedTo: assignee,
      },
      () => {}
    );
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((p) => !p)}>Assign</button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, width: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            style={{ width: '100%', marginBottom: 8 }}
          >
            <option value="">Select member</option>
            {selectableMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.userId} ({m.role})
              </option>
            ))}
          </select>
          <button onClick={assign} style={{ width: '100%' }}>
            Assign task
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskAssignmentExtension;
