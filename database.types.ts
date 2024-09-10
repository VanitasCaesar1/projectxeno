export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      Anime: {
        Row: {
          aired: string | null
          aired_string: string | null
          airing: boolean | null
          anime_id: number
          duration: string | null
          episodes: string | null
          genre: string | null
          licensor: string | null
          producer: string | null
          rating: string | null
          related: string | null
          source: string | null
          status: string | null
          studio: string | null
          title: string
          type: string | null
        }
        Insert: {
          aired?: string | null
          aired_string?: string | null
          airing?: boolean | null
          anime_id: number
          duration?: string | null
          episodes?: string | null
          genre?: string | null
          licensor?: string | null
          producer?: string | null
          rating?: string | null
          related?: string | null
          source?: string | null
          status?: string | null
          studio?: string | null
          title: string
          type?: string | null
        }
        Update: {
          aired?: string | null
          aired_string?: string | null
          airing?: boolean | null
          anime_id?: number
          duration?: string | null
          episodes?: string | null
          genre?: string | null
          licensor?: string | null
          producer?: string | null
          rating?: string | null
          related?: string | null
          source?: string | null
          status?: string | null
          studio?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      Books: {
        Row: {
          author: string | null
          awards: string | null
          bookId: string
          characters: string | null
          description: string | null
          firstPublishDate: string | null
          genres: string | null
          isbn: string | null
          language: string | null
          pages: string | null
          publishDate: string | null
          publisher: string | null
          series: string | null
          title: string
        }
        Insert: {
          author?: string | null
          awards?: string | null
          bookId: string
          characters?: string | null
          description?: string | null
          firstPublishDate?: string | null
          genres?: string | null
          isbn?: string | null
          language?: string | null
          pages?: string | null
          publishDate?: string | null
          publisher?: string | null
          series?: string | null
          title: string
        }
        Update: {
          author?: string | null
          awards?: string | null
          bookId?: string
          characters?: string | null
          description?: string | null
          firstPublishDate?: string | null
          genres?: string | null
          isbn?: string | null
          language?: string | null
          pages?: string | null
          publishDate?: string | null
          publisher?: string | null
          series?: string | null
          title?: string
        }
        Relationships: []
      }
      Movies: {
        Row: {
          Budget: number | null
          "Color/B&W": string | null
          Country: string | null
          "Director Name": string | null
          "Duration (min)": number | null
          Genre: string | null
          "Gross Revenue": number | null
          Language: string | null
          "Lead Actor": string | null
          "Release Date": string | null
          Title: string
        }
        Insert: {
          Budget?: number | null
          "Color/B&W"?: string | null
          Country?: string | null
          "Director Name"?: string | null
          "Duration (min)"?: number | null
          Genre?: string | null
          "Gross Revenue"?: number | null
          Language?: string | null
          "Lead Actor"?: string | null
          "Release Date"?: string | null
          Title: string
        }
        Update: {
          Budget?: number | null
          "Color/B&W"?: string | null
          Country?: string | null
          "Director Name"?: string | null
          "Duration (min)"?: number | null
          Genre?: string | null
          "Gross Revenue"?: number | null
          Language?: string | null
          "Lead Actor"?: string | null
          "Release Date"?: string | null
          Title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
