export default function SignalsSkeleton() {
  return (
    <>
      {/* Signal Notifications Skeleton */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50 mb-4" style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderRadius: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '1.5rem',
        border: '1px solid rgba(229, 229, 229, 0.5)'
      }}>
        <h2 className="text-xl font-bold text-neutral-900 mb-4">📨 Incoming Signals</h2>
        
        <div className="space-y-3">
          {/* Skeleton signal items */}
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              borderRadius: '0.75rem',
              border: '1px solid rgba(229, 229, 229, 0.3)',
              padding: '1rem'
            }}>
              <div className="flex-1">
                {/* Skeleton signal text */}
                <div className="w-40 h-4 bg-neutral-200 rounded animate-pulse mb-2"></div>
                <div className="w-32 h-3 bg-neutral-100 rounded animate-pulse mb-1"></div>
                <div className="w-24 h-3 bg-neutral-100 rounded animate-pulse"></div>
              </div>
              
              {/* Skeleton buttons */}
              <div className="flex space-x-2 ml-4">
                <div className="w-16 h-7 bg-green-200 rounded-lg animate-pulse"></div>
                <div className="w-16 h-7 bg-neutral-200 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))}
          
          {/* Empty state skeleton */}
          <div className="text-center py-4">
            <div className="w-32 h-4 bg-neutral-200 rounded animate-pulse mx-auto mb-2"></div>
            <div className="w-48 h-3 bg-neutral-100 rounded animate-pulse mx-auto"></div>
          </div>
        </div>
      </div>

      {/* Sent Signals Skeleton */}
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-neutral-200/50 mb-4" style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(8px)',
        borderRadius: '1.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '1.5rem',
        border: '1px solid rgba(229, 229, 229, 0.5)'
      }}>
        <h2 className="text-xl font-bold text-neutral-900 mb-4">📤 Sent Signals</h2>
        
        <div className="space-y-3">
          {/* Skeleton sent signal items */}
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-neutral-200/30" style={{
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(8px)',
              borderRadius: '0.75rem',
              border: '1px solid rgba(229, 229, 229, 0.3)',
              padding: '1rem'
            }}>
              <div className="flex-1">
                {/* Skeleton status and recipient */}
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-neutral-300 animate-pulse"></div>
                  <div className="w-32 h-4 bg-neutral-200 rounded animate-pulse"></div>
                </div>
                
                {/* Skeleton message */}
                <div className="w-40 h-3 bg-neutral-100 rounded animate-pulse mb-1"></div>
                
                {/* Skeleton metadata */}
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-3 bg-neutral-100 rounded animate-pulse"></div>
                  <div className="w-24 h-3 bg-neutral-100 rounded animate-pulse"></div>
                </div>
              </div>
              
              {/* Skeleton action */}
              <div className="w-20 h-7 bg-neutral-200 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
