import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set up Supabase session
    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { reportType, reportUrl, reportDescription, contentId, contentType } = body;

    // Validate required fields
    if (!reportType || !reportDescription) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Report type and description are required' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate report type
    const validReportTypes = ['spam', 'harassment', 'inappropriate', 'copyright', 'misinformation', 'other'];
    if (!validReportTypes.includes(reportType)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid report type' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate content type if provided
    const validContentTypes = ['review', 'profile', 'comment', 'media', 'other'];
    if (contentType && !validContentTypes.includes(contentType)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid content type' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate reports (same user reporting same content within 24 hours)
    if (contentId && contentType) {
      const { data: existingReport } = await supabase
        .from('content_reports')
        .select('id')
        .eq('reporter_id', user.id)
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (existingReport) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DUPLICATE_REPORT', message: 'You have already reported this content recently' }
        }), { 
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Create the report
    const reportData = {
      reporter_id: user.id,
      report_type: reportType,
      content_type: contentType || 'other',
      content_id: contentId || null,
      content_url: reportUrl || null,
      description: reportDescription.trim(),
      status: 'pending',
      metadata: {
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        reported_at: new Date().toISOString()
      }
    };

    const { data: report, error: reportError } = await supabase
      .from('content_reports')
      .insert(reportData)
      .select()
      .single();

    if (reportError) {
      console.error('Error creating report:', reportError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to submit report' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the report for monitoring (in a real app, you might send to a monitoring service)
    console.log(`Content report submitted: ${report.id} by user ${user.id} for ${reportType}`);

    // Auto-moderate based on report type and user history
    await performAutoModeration(report.id, reportType, contentId, contentType);

    return new Response(JSON.stringify({
      success: true,
      data: {
        reportId: report.id,
        message: 'Report submitted successfully. Our moderation team will review it shortly.'
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Report submission error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Auto-moderation function
async function performAutoModeration(reportId: string, reportType: string, contentId?: string, contentType?: string) {
  try {
    // Get report count for this content
    if (contentId && contentType) {
      const { data: reportCount } = await supabase
        .from('content_reports')
        .select('id', { count: 'exact' })
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .eq('status', 'pending');

      // Auto-hide content if it receives multiple reports
      if (reportCount && reportCount.length >= 3) {
        await autoHideContent(contentId, contentType, 'multiple_reports');
      }
    }

    // Immediate action for certain report types
    if (['spam', 'harassment'].includes(reportType) && contentId && contentType) {
      // Flag for priority review
      await supabase
        .from('content_reports')
        .update({ 
          status: 'priority',
          metadata: { auto_flagged: true, reason: 'high_priority_type' }
        })
        .eq('id', reportId);
    }

  } catch (error) {
    console.error('Auto-moderation error:', error);
  }
}

// Auto-hide content function
async function autoHideContent(contentId: string, contentType: string, reason: string) {
  try {
    let updateResult;

    switch (contentType) {
      case 'review':
        updateResult = await supabase
          .from('reviews')
          .update({ 
            metadata: { hidden: true, hidden_reason: reason, hidden_at: new Date().toISOString() }
          })
          .eq('id', contentId);
        break;
      
      case 'profile':
        updateResult = await supabase
          .from('user_profiles')
          .update({ 
            privacy_level: 'private',
            metadata: { auto_hidden: true, hidden_reason: reason, hidden_at: new Date().toISOString() }
          })
          .eq('id', contentId);
        break;
    }

    if (updateResult?.error) {
      console.error('Error auto-hiding content:', updateResult.error);
    } else {
      console.log(`Auto-hidden ${contentType} ${contentId} due to ${reason}`);
    }

  } catch (error) {
    console.error('Auto-hide content error:', error);
  }
}

// GET endpoint for fetching user's reports (for admin or user to see their reports)
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    // Check authentication
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set up Supabase session
    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user's reports
    const { data: reports, error: reportsError } = await supabase
      .from('content_reports')
      .select('*')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch reports' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: reports || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reports fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};