'use client';
import { useState } from 'react';
import { Pencil, Check, Coffee, Sun, Moon, Utensils } from 'lucide-react';
import { useDashboard } from '@/features/dashboard/context';
import { Badge, EmptyState } from '@/components/ui/primitives';
import type { MenuDay } from '@/lib/types';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function Food() {
  const { data, user, mutate, busy } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MenuDay[]>([]);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const menu = editing ? draft : data.menu;
  function start() {
    setDraft(
      days.map(
        (day) =>
          data.menu.find((m) => m.day === day) || { day, breakfast: '', lunch: '', dinner: '' },
      ),
    );
    setEditing(true);
  }
  function change(day: string, meal: 'breakfast' | 'lunch' | 'dinner', value: string) {
    setDraft((d) => d.map((m) => (m.day === day ? { ...m, [meal]: value } : m)));
  }
  async function save() {
    if (
      await mutate({
        type: 'menu-save',
        menu: draft.map((m) => ({
          ...m,
          day: m.day as
            'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday',
        })),
      })
    )
      setEditing(false);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">GOOD FOOD. GOOD DAYS.</span>
          <h1>Food timetable</h1>
          <p>A week of meals to look forward to.</p>
        </div>
        {user.role === 'OWNER' &&
          data.property.food &&
          (editing ? (
            <div className="heading-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={
                  busy ||
                  draft.some((d) => !d.breakfast.trim() || !d.lunch.trim() || !d.dinner.trim())
                }
                onClick={() => void save()}
              >
                <Check size={16} /> Publish menu
              </button>
            </div>
          ) : (
            <button className="button primary" onClick={start}>
              <Pencil size={16} /> Edit weekly menu
            </button>
          ))}
      </div>
      {!data.property.food ? (
        <section className="panel">
          <EmptyState
            title="No mess service"
            description="This PG doesn’t currently offer a food service."
          />
        </section>
      ) : (
        <section className="panel menu-panel">
          <div className="panel-heading">
            <div>
              <h2>
                <Utensils size={18} /> The weekly menu
              </h2>
              <p>Freshly made, every day at {data.property.name}.</p>
            </div>
            <Badge tone="green">{editing ? 'Editing draft' : 'Weekly timetable'}</Badge>
          </div>
          <div className="menu-grid">
            <div className="menu-header">
              <span>DAY</span>
              <span>
                <Coffee size={17} />
                <strong>Breakfast</strong>
                <small>7:30 – 9:30 AM</small>
              </span>
              <span>
                <Sun size={17} />
                <strong>Lunch</strong>
                <small>12:30 – 2:30 PM</small>
              </span>
              <span>
                <Moon size={17} />
                <strong>Dinner</strong>
                <small>7:30 – 9:30 PM</small>
              </span>
            </div>
            {days.map((day) => {
              const m = menu.find((m) => m.day === day);
              return (
                <div className={`menu-row ${today === day ? 'today' : ''}`} key={day}>
                  <div className="menu-day">
                    <strong>{day}</strong>
                    {today === day && <span>Today</span>}
                  </div>
                  {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                    <div className="menu-cell" key={meal}>
                      <span className="mobile-meal-label">{meal}</span>
                      {editing ? (
                        <textarea
                          aria-label={`${day} ${meal}`}
                          maxLength={200}
                          value={m?.[meal] || ''}
                          onChange={(e) => change(day, meal, e.target.value)}
                          rows={2}
                        />
                      ) : (
                        <span>{m?.[meal] || 'Menu not published yet'}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="panel-footer">
            <span>Have a dietary concern? Share it through a food complaint.</span>
            <span>Menu may vary with seasonal availability.</span>
          </div>
        </section>
      )}
    </>
  );
}
