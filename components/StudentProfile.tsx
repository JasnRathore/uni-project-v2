"use client";
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { RoleAvatar } from "./RoleAvatar";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  ImagePlus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "./ui/loading";

interface StudentProfileProps {
  student: any;
  accessToken: string;
  onUpdate: (data: any) => void;
  isTeacherEditing?: boolean;
}

export function StudentProfile({ student, accessToken, onUpdate, isTeacherEditing = false }: StudentProfileProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileData, setProfileData] = useState({
    name: student?.name || "",
    email: student?.email || "",
    prn: student?.prn || "",
    phone: student?.phone || "",
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
    <div className="student-profile mx-auto max-w-4xl space-y-6 pb-12">
      <div className="student-profile-mobile-header hidden">
        <ImagePlus aria-hidden="true" className="size-8" />
        <h2 className="text-xl font-semibold">{profileData.name || "Student"}</h2>
        <p className="text-sm text-muted-foreground">Student account</p>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={() => document.getElementById("name")?.focus()}
        >
          <Pencil aria-hidden="true" />
          Edit Profile
        </Button>
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Profile information</CardTitle>
          <CardDescription>Update your personal and contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar Section */}
          <div className="student-profile-identity flex flex-wrap items-center gap-5 border-b pb-6">
            <div className="student-profile-avatar">
              <RoleAvatar
                role="student"
                identifier={student?.id || student?.email}
                name={profileData.name}
                className="size-20 border-4 border-background"
                fallbackClassName="text-2xl font-bold"
              />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold">{profileData.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Student account</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="student-profile-form space-y-6">
            <div className="student-profile-fields grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Full Name */}
              <div className="student-profile-field-name space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold"><span className="student-profile-label-icon hidden"><User aria-hidden="true" /></span>Full Name</Label>
                <div className="relative">
                  <User aria-hidden="true" className="student-profile-input-icon absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
              <div className="student-profile-field-email space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold"><span className="student-profile-label-icon hidden"><Mail aria-hidden="true" /></span>Email Address</Label>
                <div className="relative">
                  <Mail aria-hidden="true" className="student-profile-input-icon absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    value={profileData.email}
                    disabled
                    className="h-11 pl-10"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="student-profile-field-phone space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold"><span className="student-profile-label-icon hidden"><Phone aria-hidden="true" /></span>Phone Number</Label>
                <div className="relative">
                  <Phone aria-hidden="true" className="student-profile-input-icon absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-11 pl-10"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

            </div>

            {/* Address */}
            <div className="student-profile-field-address space-y-2">
              <Label htmlFor="address" className="text-sm font-semibold"><span className="student-profile-label-icon hidden"><MapPin aria-hidden="true" /></span>Address</Label>
              <div className="relative">
                <MapPin aria-hidden="true" className="student-profile-input-icon absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
            <div className="student-profile-field-bio space-y-2">
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

            <div className="student-profile-save flex justify-end border-t pt-5">
              <Button
                type="submit"
                disabled={isUpdating}
                className="min-h-11 px-8"
              >
                {isUpdating ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner className="size-4 text-primary-foreground" />
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
