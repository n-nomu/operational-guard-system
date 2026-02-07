'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getAnnouncements, addAnnouncement, deleteAnnouncement } from '@/lib/storage';
import type { Announcement } from '@/lib/types';
import { t, type Language } from '@/lib/i18n';

interface AnnouncementBoardProps {
  isAdmin: boolean;
  lang?: Language;
}

export function AnnouncementBoard({ isAdmin, lang = 'ja' }: AnnouncementBoardProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('12:00');

  useEffect(() => {
    setAnnouncements(getAnnouncements());
  }, []);

  // Generate 1-hour interval time options
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  const handleAdd = () => {
    if (!message.trim()) return;

    let deadline: string | undefined;
    if (deadlineDate) {
      const dt = new Date(`${deadlineDate}T${deadlineTime}`);
      deadline = dt.toISOString();
    }

    const newAnnouncement: Announcement = {
      id: crypto.randomUUID(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      deadline,
    };

    addAnnouncement(newAnnouncement);
    setAnnouncements([newAnnouncement, ...announcements]);
    setMessage('');
    setDeadlineDate('');
    setDeadlineTime('12:00');
    setIsAddOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteAnnouncement(id);
    setAnnouncements(announcements.filter(a => a.id !== id));
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Announcements</CardTitle>
              <CardDescription>{announcements.length} message(s)</CardDescription>
            </div>
          </div>

          {isAdmin && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Post
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card">
                <DialogHeader>
                  <DialogTitle>Post Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your announcement..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Submission Deadline (Optional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={deadlineDate || ''}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <select
                        value={deadlineTime}
                        onChange={(e) => setDeadlineTime(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If set, staff will see a countdown banner
                    </p>
                  </div>
                  <Button onClick={handleAdd} className="w-full" disabled={!message.trim()}>
                    Post Announcement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {announcements.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No announcements</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-3 rounded-lg bg-secondary/50 relative group"
              >
                <p className="text-sm text-foreground pr-8">{announcement.message}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                  {announcement.deadline && (
                    <span className={`flex items-center gap-1 ${
                      isDeadlinePassed(announcement.deadline) ? 'text-destructive' : 'text-warning'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {isDeadlinePassed(announcement.deadline) 
                        ? 'Deadline passed' 
                        : `Due: ${formatDeadline(announcement.deadline)}`}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
