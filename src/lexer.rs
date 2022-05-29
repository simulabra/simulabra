use crate::parser::SourceExpression;

#[derive(Debug)]
pub struct LexerError(pub String);

pub struct Lexer {
    program: String,
    cur_idx: usize,
}

impl Lexer {
    pub fn new(program: String) -> Self {
        Self {
            program,
            cur_idx: 0,
        }
    }

    fn error(&self, msg: String) -> LexerError {
        LexerError(format!("Lexer error at {}: {}", self.cur_idx, msg))
    }

    fn cur(&self) -> char {
        if self.ended() {
            '\n'
        } else {
            self.program.chars().nth(self.cur_idx).unwrap()
        }
    }

    fn chomp(&mut self) -> char {
        let c = self.cur();
        self.cur_idx += 1;
        c
    }

    fn ended(&self) -> bool {
        self.cur_idx >= self.program.len()
    }


    fn terminal_char(&self) -> bool {
        self.ended() || ";) \n".contains(self.cur())
    }

    fn comment_terminal(&self) -> bool {
        self.ended() || "\n;".contains(self.cur())
    }


    fn next(&mut self) -> Result<Token, LexerError> {
        let mut c = self.chomp();
        while c == ' ' || c == '\n' {
            c = self.chomp();
            if self.ended() {
                return Ok(Token::EOF)
            }
        }
        match c {
            '(' => Ok(Token::LParen),
            ')' => Ok(Token::RParen),
            '[' => Ok(Token::LBrace),
            ']' => Ok(Token::RBrace),
            '{' => Ok(Token::LBracket),
            '}' => Ok(Token::RBracket),
            '.' => Ok(Token::Dot),
            'a'..'z' | '*' | '+' | '-' | '/' => {
                let mut message = String::from(c);
                while !self.terminal_char() {
                    message.push(self.chomp());
                }
                Ok(Token::Message(message))
            },
            'A'..'Z' => {
                let mut symbol = String::from(c);
                while !self.terminal_char() {
                    symbol.push(self.chomp());
                }
                Ok(Token::Symbol(symbol))
            },
            '0'..'9' => {
                let mut number = String::from(c);
                let mut float = false;
                while !self.terminal_char() {
                    if self.cur() == '.' {
                        float = true;
                    }

                    number.push(self.chomp());
                }

                if float {
                    number.parse().map(|n| Token::Float(n)).map_err(|e| self.error(e.to_string()))
                } else {
                    number.parse().map(|n| Token::Integer(n)).map_err(|e| self.error(e.to_string()))
                }
            },
            ';' => {
                let mut comment = String::new();
                while !self.comment_terminal() {
                    comment.push(self.chomp());
                }
                // eat terminal
                self.chomp();
                Ok(Token::Comment(comment))
            },
            _ => Err(self.error(format!("invalid char {}", c)))
        }
    }

    pub fn tokens(&mut self) -> Result<Vec<Token>, LexerError> {
        let mut toks = Vec::new();
        loop {
            let tok = self.next()?;
            if tok == Token::EOF {
                break;
            } else {
                toks.push(tok);
            }
        }

        Ok(toks)
    }
}


#[derive(PartialEq, Debug, Clone)]
pub enum Token {
    LParen, // (
    RParen, // )
    LBrace, // [
    RBrace, // ]
    LBracket, // {
    RBracket, // }
    Symbol(String), // Symbol
    Message(String), // message
    Integer(isize), // 12
    Float(f32), // 12.3
    Dot, // .
    Comment(String), // ; comment ;
    EOF,
}
