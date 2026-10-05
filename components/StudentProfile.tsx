"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { RoleAvatar } from "./RoleAvatar";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  BookOpen,
  Save,
  Camera,
  Bell,
  Zap,
  Clock,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

interface StudentProfileProps {
  student: any;
  onBack: () => void;
  accessToken: string;
  projectId: string;
  onUpdate: (data: any) => void;
  isTeacherEditing?: boolean;
}

export function StudentProfile({ student, onBack, accessToken, projectId, onUpdate, isTeacherEditing = false }: StudentProfileProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileData, setProfileData] = useState({
    name: student?.name || "",
    email: student?.email || "",
    username: student?.username || "",
    rollNumber: student?.rollNumber || "",
    batch: student?.batch || "",
    class: student?.class || "",
    phone: student?.phone || "",
    department: student?.department || "",
    semester: student?.semester || "",
    specialization: student?.specialization || "",
    qualification: student?.qualification || "",
    joinDate: student?.joinDate || "January 2024",
    address: student?.address || "",
    bio: student?.bio || "",
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement> | undefined) => {
    if (e) e.preventDefault();
    setIsUpdating(true);
    try {
      const response = await fetch(
        isTeacherEditing
          ? `/api/teacher/students/${encodeURIComponent(student.id)}`
          : `/api/student/profile/update`,
        {
          method: isTeacherEditing ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(profileData),
        },
      );

      if (response.ok) {
        toast.success("Profile updated successfully!");
        if (onUpdate) onUpdate(profileData);
      } else {
        toast.error("Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-2">
        <Button onClick={onBack} variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {isTeacherEditing ? "Back to Students" : "Back to Dashboard"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal and professional details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <RoleAvatar
                role="student"
                identifier={student?.id || student?.email}
                name={profileData.name}
                className="size-24 border-4 border-background shadow-xl"
                fallbackClassName="text-2xl font-bold"
              />
              <Button
                size="sm"
                className="absolute -bottom-2 -right-2 size-8 rounded-full border-2 border-background p-0"
              >
                <Camera className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{profileData.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{profileData.department || "General Dentistry"}</p>
              <Button variant="outline" size="sm" className="h-8">Change Photo</Button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-11 pl-10"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={profileData.email}
                    disabled
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-11 pl-10"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-semibold">Department</Label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="department"
                    value={profileData.department}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
                    className="h-11 pl-10"
                    placeholder="e.g. Oral Pathology"
                  />
                </div>
              </div>

              {/* Specialization */}
              <div className="space-y-2">
                <Label htmlFor="specialization" className="text-sm font-semibold">Specialization</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="specialization"
                    value={profileData.specialization || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, specialization: e.target.value }))}
                    className="h-11 pl-10"
                    placeholder="e.g. Oral Medicine and Radiology"
                  />
                </div>
              </div>

              {/* Qualification */}
              <div className="space-y-2">
                <Label htmlFor="qualification" className="text-sm font-semibold">Qualification</Label>
                <Input
                  id="qualification"
                  value={profileData.qualification || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, qualification: e.target.value }))}
                  className="h-11"
                  placeholder="e.g. BDS, MDS"
                />
              </div>

              {/* Academic Year */}
              <div className="space-y-2">
                <Label htmlFor="batch" className="text-sm font-semibold">Academic Year / Batch</Label>
                <Input
                  id="batch"
                  value={profileData.batch || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, batch: e.target.value }))}
                  className="h-11"
                  placeholder="e.g. 2024 Batch"
                />
              </div>

              {/* Join Date */}
              <div className="space-y-2">
                <Label htmlFor="joinDate" className="text-sm font-semibold">Join Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="joinDate"
                    value={profileData.joinDate || "January 2024"}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, joinDate: e.target.value }))}
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-semibold">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="address"
                  value={profileData.address || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                  className="h-11 pl-10"
                  placeholder="Enter your campus address"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-sm font-semibold">Bio</Label>
              <Textarea
                id="bio"
                value={profileData.bio || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                rows={4}
                className="resize-none"
                placeholder="Passionate about dental education and clinical excellence..."
              />
            </div>

            <div className="flex pt-4">
              <Button
                type="submit"
                disabled={isUpdating}
                className="h-11 px-10"
              >
                {isUpdating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
