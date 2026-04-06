import { motion } from "framer-motion"
import { Calendar, MessageCircle, Shield, Video } from "lucide-react"
import { Logo } from "@/components/logo"

interface AppPreviewProps {
  variant?: "dashboard" | "booking" | "chat"
}

export function AppPreview({ variant = "dashboard" }: AppPreviewProps) {
  if (variant === "dashboard") {
    return (
      <div className="bg-gradient-to-b from-primary/5 to-white h-full">
        {/* App Header */}
        <div className="p-4 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <Logo variant="horizontal" size="sm" />
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">J</span>
            </div>
          </div>
        </div>
        
        {/* Dashboard Content */}
        <div className="p-4 space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 shadow-sm"
          >
            <h3 className="font-semibold text-sm mb-2">Next Appointment</h3>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium">Dr. Sarah Johnson</p>
                <p className="text-xs text-gray-500">Today, 2:30 PM</p>
              </div>
            </div>
          </motion.div>
          
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <Video className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs font-medium">Video Call</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <MessageCircle className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-xs font-medium">Messages</p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white h-full p-4">
      <p className="text-center text-gray-500 text-sm">App Preview</p>
    </div>
  )
}